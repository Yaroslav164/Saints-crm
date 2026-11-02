import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";
import {
  DAY_MS,
  calculateCR,
  calculateProfit,
  calculateROI,
  roundTo,
  utcDayStart,
} from "@/lib/utils";
import type { AnalyticsWindowForm, TopBundlesQuery } from "@/lib/validations";
import type {
  AnalyticsSummary,
  AnalyticsWindowDto,
  BuyerSlice,
  FunnelStage,
  MetricSlice,
  OfferSlice,
  TopBundleRow,
} from "@/types";
import type { BundleStatus } from "@/lib/generated/prisma/enums";

/**
 * Analytics for the /analytics screen (stage 6).
 *
 * Everything is read from `BundleMetric` rather than from the lifetime totals on
 * `Bundle`: a period question can only be answered by daily rows. The totals on the
 * bundle stay authoritative for the edit form, which is why the same bundle can look
 * bigger here than in the table — this screen sums what happened *inside the window*.
 *
 * Archived bundles are included: their spend happened, and excluding it would inflate
 * the team's profit. The status funnel is deliberately not windowed — see `buildFunnel`.
 */

type Window = { from: Date; to: Date; days: number };

type BundleWindowRow = {
  id: string;
  name: string;
  status: BundleStatus;
  isArchived: boolean;
  offer: { id: string; name: string; payoutUSD: number };
  buyer: { id: string; name: string };
  spent: number;
  revenue: number;
  clicks: number;
  conversions: number;
};

/**
 * Day bounds are UTC because `BundleMetric.date` is a Postgres DATE handed back as
 * UTC midnight; comparing it against a local bound would shift the window by the
 * machine's offset (see `utcDayStart`).
 */
function resolveWindow(query: AnalyticsWindowForm): Window {
  if (!query.from && !query.to) {
    return { from: utcDayStart(query.days - 1), to: utcDayStart(0), days: query.days };
  }

  const from = query.from ?? (query.to as Date);
  const to = query.to ?? (query.from as Date);
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
  // The range is picked by hand, so an absurd one is refused instead of scanned.
  if (days > 366) throw new ApiError(422, "The period must be a year or shorter", { from: "Pick a shorter range" });

  return { from, to, days };
}

/** The period of the same length that ends the day before this one starts. */
function previousWindow(window: Window): Window {
  const to = new Date(window.from.getTime() - DAY_MS);
  return { from: new Date(to.getTime() - (window.days - 1) * DAY_MS), to, days: window.days };
}

function windowDto(window: Window, previous: Window): AnalyticsWindowDto {
  return {
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    days: window.days,
    previousFrom: previous.from.toISOString(),
    previousTo: previous.to.toISOString(),
  };
}

/**
 * Two queries per window: `groupBy` folds the daily rows into one sum per bundle, and
 * only the bundles that actually appear are then loaded with their owner and offer.
 * The dashboard does the same thing for one window; here the comparison period makes
 * it two, still bounded by the window instead of by the whole table.
 */
async function readBundleWindow(window: Window): Promise<BundleWindowRow[]> {
  const groups = await prisma.bundleMetric.groupBy({
    by: ["bundleId"],
    where: { date: { gte: window.from, lte: window.to } },
    _sum: { spent: true, revenue: true, clicks: true, conversions: true },
  });
  if (groups.length === 0) return [];

  const rows = await prisma.bundle.findMany({
    where: { id: { in: groups.map((group) => group.bundleId) } },
    select: {
      id: true,
      name: true,
      status: true,
      isArchived: true,
      offer: { select: { id: true, name: true, payoutUSD: true } },
      user: { select: { id: true, name: true } },
    },
  });

  const sumsById = new Map(groups.map((group) => [group.bundleId, group._sum]));

  return rows.map((row) => {
    const sums = sumsById.get(row.id);
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      isArchived: row.isArchived,
      offer: row.offer,
      buyer: row.user,
      spent: roundTo(sums?.spent ?? 0),
      revenue: roundTo(sums?.revenue ?? 0),
      clicks: sums?.clicks ?? 0,
      conversions: sums?.conversions ?? 0,
    };
  });
}

/**
 * One sum for a group of bundles. ROI is computed from the group's totals rather than
 * averaged over the members' ROIs: a $10 test and a $10,000 test must not weigh the same.
 */
function sliceOf(rows: BundleWindowRow[]): MetricSlice {
  const spent = roundTo(rows.reduce((sum, row) => sum + row.spent, 0));
  const revenue = roundTo(rows.reduce((sum, row) => sum + row.revenue, 0));
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const conversions = rows.reduce((sum, row) => sum + row.conversions, 0);

  return {
    spent,
    revenue,
    profit: roundTo(calculateProfit(revenue, spent)),
    roi: roundTo(calculateROI(revenue, spent), 1),
    clicks,
    conversions,
    cr: roundTo(calculateCR(conversions, clicks), 2),
    bundles: rows.length,
  };
}

function groupBy(rows: BundleWindowRow[], keyOf: (row: BundleWindowRow) => string): Map<string, BundleWindowRow[]> {
  const groups = new Map<string, BundleWindowRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

/**
 * Funnel over the *current* status of every active bundle, not over the window: a
 * status is a state, not an event, and the daily rows carry no status. Reading it
 * from the window would silently drop every bundle that stopped spending this month.
 * The first stage is the same set the `counts.active` card reports.
 */
function buildFunnel(statusGroups: { status: BundleStatus; _count: { _all: number } }[]): FunnelStage[] {
  const countOf = (...statuses: (BundleStatus | "ALL")[]) =>
    statusGroups
      .filter((group) => statuses.includes("ALL") || statuses.includes(group.status))
      .reduce((sum, group) => sum + group._count._all, 0);

  const raw = [
    { key: "in_play", label: "In play", count: countOf("ALL") },
    { key: "tested", label: "Reached a test", count: countOf("TESTING", "PROFIT", "LOSS", "SCALE") },
    { key: "profitable", label: "Earned more than spent", count: countOf("PROFIT", "SCALE") },
    { key: "scaling", label: "Scaled", count: countOf("SCALE") },
  ];
  const total = raw[0]?.count ?? 0;

  return raw.map((stage, index) => {
    const previous = index === 0 ? null : raw[index - 1];
    return {
      key: stage.key,
      label: stage.label,
      count: stage.count,
      share: total ? roundTo((stage.count / total) * 100, 1) : 0,
      conversion: !previous || previous.count === 0 ? null : roundTo((stage.count / previous.count) * 100, 1),
    };
  });
}

export async function getAnalyticsSummary(query: AnalyticsWindowForm): Promise<AnalyticsSummary> {
  const window = resolveWindow(query);
  const previous = previousWindow(window);

  const [rows, previousRows, statusGroups, archived] = await Promise.all([
    readBundleWindow(window),
    readBundleWindow(previous),
    prisma.bundle.groupBy({ by: ["status"], where: { isArchived: false }, _count: { _all: true } }),
    prisma.bundle.count({ where: { isArchived: true } }),
  ]);

  const totals = sliceOf(rows);
  const before = sliceOf(previousRows);
  const withSpend = rows.filter((row) => row.spent > 0);

  return {
    window: windowDto(window, previous),
    totals,
    previous: before,
    profitChange: roundTo(totals.profit - before.profit),
    roiChange: roundTo(totals.roi - before.roi, 1),
    avgBundleRoi: withSpend.length
      ? roundTo(
          withSpend.reduce((sum, row) => sum + calculateROI(row.revenue, row.spent), 0) / withSpend.length,
          1,
        )
      : 0,
    profitableShare: withSpend.length
      ? roundTo((withSpend.filter((row) => row.revenue > row.spent).length / withSpend.length) * 100, 1)
      : 0,
    counts: {
      active: statusGroups.reduce((sum, group) => sum + group._count._all, 0),
      archived,
      inWindow: rows.length,
    },
    funnel: buildFunnel(statusGroups),
  };
}

/** Profit per buyer, best first. */
export async function getAnalyticsByBuyer(query: AnalyticsWindowForm): Promise<{ window: AnalyticsWindowDto; rows: BuyerSlice[] }> {
  const window = resolveWindow(query);
  const previous = previousWindow(window);
  const rows = await readBundleWindow(window);

  const slices = Array.from(groupBy(rows, (row) => row.buyer.id).values()).map((group) => ({
    ...sliceOf(group),
    buyer: { id: group[0].buyer.id, label: group[0].buyer.name },
  }));

  return {
    window: windowDto(window, previous),
    rows: slices.sort((a, b) => b.profit - a.profit),
  };
}

/** Revenue against spend per offer, best profit first. */
export async function getAnalyticsByOffer(query: AnalyticsWindowForm): Promise<{ window: AnalyticsWindowDto; rows: OfferSlice[] }> {
  const window = resolveWindow(query);
  const previous = previousWindow(window);
  const rows = await readBundleWindow(window);

  const slices = Array.from(groupBy(rows, (row) => row.offer.id).values()).map((group) => ({
    ...sliceOf(group),
    offer: { id: group[0].offer.id, label: group[0].offer.name },
    payoutUSD: group[0].offer.payoutUSD,
  }));

  return {
    window: windowDto(window, previous),
    rows: slices.sort((a, b) => b.profit - a.profit),
  };
}

/**
 * Ranked bundles for the period. No spend means no evidence, so those rows are left
 * out — the same rule as the dashboard's top-5. `order=asc` answers the opposite
 * question ("what should we drain") with the same code.
 */
export async function getTopBundles(query: TopBundlesQuery): Promise<{ window: AnalyticsWindowDto; rows: TopBundleRow[] }> {
  const window = resolveWindow(query);
  const previous = previousWindow(window);
  const statuses = query.status ?? [];

  const rows = (await readBundleWindow(window))
    .filter((row) => row.spent > 0)
    .filter((row) => (query.userId ? row.buyer.id === query.userId : true))
    .filter((row) => (query.offerId ? row.offer.id === query.offerId : true))
    .filter((row) => (statuses.length ? statuses.includes(row.status) : true));

  const ranked: TopBundleRow[] = rows.map((row) => ({
    ...sliceOf([row]),
    id: row.id,
    name: row.name,
    status: row.status,
    offer: { id: row.offer.id, label: row.offer.name },
    buyer: { id: row.buyer.id, label: row.buyer.name },
  }));

  ranked.sort((a, b) => (query.order === "asc" ? a.roi - b.roi : b.roi - a.roi));

  return { window: windowDto(window, previous), rows: ranked.slice(0, query.limit) };
}
