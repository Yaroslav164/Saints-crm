import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import { STATUS_META, STATUS_ORDER } from "@/lib/status";
import { calculateProfit, calculateROI, formatDayKey, formatDayLabel, roundTo, utcDayStart } from "@/lib/utils";
import type { BundleStatus } from "@/lib/generated/prisma/enums";

export type StatusSlice = {
  status: BundleStatus;
  label: string;
  emoji: string;
  /** Literal colors per theme: Recharts cannot resolve CSS variables in SVG. */
  color: { light: string; dark: string };
  count: number;
};
export type DayPoint = { day: string; label: string; revenue: number; spent: number; profit: number };
export type TopBundle = {
  id: string;
  name: string;
  status: BundleStatus;
  offer: string;
  buyer: string;
  revenue: number;
  spent: number;
  profit: number;
  roi: number;
};

export type DashboardData = {
  windowDays: number;
  totals: { revenue: number; spent: number; profit: number; roi: number };
  counts: Record<BundleStatus, number>;
  statusSlices: StatusSlice[];
  profitByDay: DayPoint[];
  topBundles: TopBundle[];
  myTesting: number;
};

/**
 * One round trip per aggregate instead of loading bundles into memory: the
 * numbers on this page are team-wide sums over the daily metric rows.
 */
export async function getDashboardData(userId: string, windowDays = 30): Promise<DashboardData> {
  return loadDashboard(userId, windowDays);
}

/**
 * Cached under the `dashboard` tag for a minute — enough for the shell to be
 * prefetched and for back-navigation to feel instant — while the bundle mutation
 * routes expire that tag immediately, so the cards never show a number from
 * before the change the user just made.
 */
async function loadDashboard(userId: string, windowDays: number): Promise<DashboardData> {
  "use cache";
  cacheTag("dashboard");
  cacheLife("minutes");

  const fromWindow = utcDayStart(windowDays - 1);
  const fromWeek = utcDayStart(6);

  const [statusGroups, dayGroups, weekByBundle, myTesting] = await Promise.all([
    prisma.bundle.groupBy({
      by: ["status"],
      where: { isArchived: false },
      _count: { _all: true },
    }),
    prisma.bundleMetric.groupBy({
      by: ["date"],
      where: { date: { gte: fromWindow } },
      _sum: { revenue: true, spent: true },
      orderBy: { date: "asc" },
    }),
    prisma.bundleMetric.groupBy({
      by: ["bundleId"],
      where: { date: { gte: fromWeek } },
      _sum: { revenue: true, spent: true },
    }),
    prisma.bundle.count({ where: { userId, status: "TESTING", isArchived: false } }),
  ]);

  const counts = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0])) as Record<BundleStatus, number>;
  for (const group of statusGroups) {
    counts[group.status] = group._count._all;
  }

  // A day with no spend still belongs on the axis, otherwise the line suggests
  // the team was idle on days that simply had no rows.
  const byDay = new Map(dayGroups.map((group) => [formatDayKey(group.date), group]));
  const profitByDay: DayPoint[] = [];
  let revenue = 0;
  let spent = 0;
  for (let offset = windowDays - 1; offset >= 0; offset--) {
    const date = utcDayStart(offset);
    const group = byDay.get(formatDayKey(date));
    const dayRevenue = roundTo(group?._sum.revenue ?? 0);
    const daySpent = roundTo(group?._sum.spent ?? 0);
    revenue += dayRevenue;
    spent += daySpent;
    profitByDay.push({
      day: formatDayKey(date),
      label: formatDayLabel(date),
      revenue: dayRevenue,
      spent: daySpent,
      profit: roundTo(calculateProfit(dayRevenue, daySpent)),
    });
  }

  const weekTotals = weekByBundle
    .map((row) => {
      const rowRevenue = roundTo(row._sum.revenue ?? 0);
      const rowSpent = roundTo(row._sum.spent ?? 0);
      return {
        bundleId: row.bundleId,
        revenue: rowRevenue,
        spent: rowSpent,
        profit: roundTo(calculateProfit(rowRevenue, rowSpent)),
        roi: roundTo(calculateROI(rowRevenue, rowSpent), 1),
      };
    })
    // No spend means no evidence, so such bundles cannot claim a top ROI.
    .filter((row) => row.spent > 0)
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 5);

  const rows = await prisma.bundle.findMany({
    where: { id: { in: weekTotals.map((row) => row.bundleId) } },
    select: {
      id: true,
      name: true,
      status: true,
      offer: { select: { name: true } },
      user: { select: { name: true } },
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  const topBundles: TopBundle[] = weekTotals.flatMap((row) => {
    const bundle = byId.get(row.bundleId);
    if (!bundle) return [];
    return [{ ...row, id: bundle.id, name: bundle.name, status: bundle.status, offer: bundle.offer.name, buyer: bundle.user.name }];
  });

  return {
    windowDays,
    totals: {
      revenue: roundTo(revenue),
      spent: roundTo(spent),
      profit: roundTo(calculateProfit(revenue, spent)),
      roi: roundTo(calculateROI(revenue, spent), 1),
    },
    counts,
    statusSlices: STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_META[status].label,
      emoji: STATUS_META[status].emoji,
      color: STATUS_META[status].chartColor,
      count: counts[status],
    })).filter((slice) => slice.count > 0),
    profitByDay,
    topBundles,
    myTesting,
  };
}
