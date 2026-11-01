import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { canManageBundle, isAdmin, type CurrentUser } from "@/lib/dal";
import { forbidden, notFound } from "@/lib/http";
import { calculateCR, calculateProfit, calculateROI, roundTo } from "@/lib/utils";
import type { BulkBundleForm, BundleQuery } from "@/lib/validations";
import type { BundleFacets, BundleListItem, BundlesResponse, Option } from "@/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { BundleStatus } from "@/lib/generated/prisma/enums";

/**
 * Bundle queries shared by the list API, the CSV export and the dashboard.
 *
 * ROI, CR and profit are derived from four stored columns, so Postgres cannot
 * order or filter on them through Prisma's `orderBy`/`where`. When such a slice
 * is requested the matching rows are read light (numbers only), processed here
 * and only the resulting page is loaded with its relations. DERIVED_SCAN_LIMIT
 * keeps that bounded; hitting it is reported instead of silently truncating.
 */
const DERIVED_SCAN_LIMIT = 2_000;

export const EXPORT_LIMIT = 5_000;

const DERIVED_SORT_KEYS = ["roi", "cr", "profit"] as const;
type DerivedSortKey = (typeof DERIVED_SORT_KEYS)[number];

const listSelect = {
  id: true,
  name: true,
  status: true,
  angle: true,
  creative: true,
  budgetPlanned: true,
  budgetSpent: true,
  revenue: true,
  clicks: true,
  conversions: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
  offer: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
  geos: { select: { id: true, code: true, name: true } },
  tags: { select: { id: true, name: true, color: true } },
} satisfies Prisma.BundleSelect;

type BundleRow = Prisma.BundleGetPayload<{ select: typeof listSelect }>;

function option(item: { id: string; name: string }): Option {
  return { id: item.id, label: item.name };
}

export function toBundleListItem(row: BundleRow): BundleListItem {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    angle: row.angle,
    creative: row.creative,
    budgetPlanned: row.budgetPlanned,
    budgetSpent: row.budgetSpent,
    revenue: row.revenue,
    clicks: row.clicks,
    conversions: row.conversions,
    isArchived: row.isArchived,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    offer: option(row.offer),
    buyer: option(row.user),
    geos: row.geos.map((geo) => ({ id: geo.id, label: geo.code })),
    tags: row.tags.map((tag) => ({ id: tag.id, label: tag.name, color: tag.color })),
    cr: roundTo(calculateCR(row.conversions, row.clicks), 2),
    roi: roundTo(calculateROI(row.revenue, row.budgetSpent), 2),
    profit: roundTo(calculateProfit(row.revenue, row.budgetSpent)),
  };
}

/** Column-level filters only; the ROI band is applied after derivation. */
function buildWhere(query: BundleQuery, currentUserId: string): Prisma.BundleWhereInput {
  const userId = query.mine ? currentUserId : query.userId;

  return {
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    ...(query.status?.length ? { status: { in: query.status } } : {}),
    ...(query.offerId ? { offerId: query.offerId } : {}),
    ...(userId ? { userId } : {}),
    ...(query.geoId ? { geos: { some: { id: query.geoId } } } : {}),
    ...(query.tagId ? { tags: { some: { id: query.tagId } } } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
    // undefined keeps archived and active rows together, which is what the list
    // shows by default; the API can narrow either way.
    ...(query.archived === undefined ? {} : { isArchived: query.archived }),
  };
}

function orderByFor(query: BundleQuery): Prisma.BundleOrderByWithRelationInput[] {
  const direction = query.order;
  const primary: Record<string, Prisma.BundleOrderByWithRelationInput> = {
    name: { name: direction },
    status: { status: direction },
    budgetPlanned: { budgetPlanned: direction },
    budgetSpent: { budgetSpent: direction },
    revenue: { revenue: direction },
    clicks: { clicks: direction },
    conversions: { conversions: direction },
    createdAt: { createdAt: direction },
    updatedAt: { updatedAt: direction },
    offer: { offer: { name: direction } },
    buyer: { user: { name: direction } },
  };

  const sort = primary[query.sort];
  // Derived keys are handled by the in-memory path; this is the tie-breaker for
  // the SQL path and the fallback order for every list.
  return [sort ?? { createdAt: "desc" }, { id: "asc" }];
}

function paginate(items: BundleListItem[], page: number, pageSize: number, total: number): BundlesResponse {
  return {
    items,
    page,
    pageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * A page number can outlive its data: the buyer deletes rows, or a shared link
 * points past the end of a narrower filter. The requested page is clamped and
 * the effective one is returned, so the range label and the next/previous
 * controls can never disagree with the rows on screen.
 */
function clampPage(query: BundleQuery, total: number): number {
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  return Math.min(Math.max(1, query.page), pageCount);
}

export async function listBundles(query: BundleQuery, currentUserId: string): Promise<BundlesResponse> {
  const where = buildWhere(query, currentUserId);
  const needsDerived =
    (DERIVED_SORT_KEYS as readonly string[]).includes(query.sort) ||
    query.roiMin !== undefined ||
    query.roiMax !== undefined;

  if (!needsDerived) {
    const total = await prisma.bundle.count({ where });
    const page = clampPage(query, total);
    const rows = await prisma.bundle.findMany({
      where,
      select: listSelect,
      orderBy: orderByFor(query),
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return paginate(rows.map(toBundleListItem), page, query.pageSize, total);
  }

  // SQL can order by any stored column, it just cannot filter by a derived one,
  // so the light read keeps the requested order and the ROI band only ever
  // removes rows from it.
  const light = await prisma.bundle.findMany({
    where,
    select: { id: true, revenue: true, budgetSpent: true, clicks: true, conversions: true },
    orderBy: orderByFor(query),
    take: DERIVED_SCAN_LIMIT + 1,
  });
  const truncated = light.length > DERIVED_SCAN_LIMIT;
  const candidates = truncated ? light.slice(0, DERIVED_SCAN_LIMIT) : light;

  let scored = candidates.map((row) => {
    const roi = calculateROI(row.revenue, row.budgetSpent);
    const cr = calculateCR(row.conversions, row.clicks);
    return { id: row.id, roi, cr, profit: calculateProfit(row.revenue, row.budgetSpent) };
  });

  if (query.roiMin !== undefined) scored = scored.filter((row) => row.roi >= query.roiMin!);
  if (query.roiMax !== undefined) scored = scored.filter((row) => row.roi <= query.roiMax!);

  const derivedKey = (DERIVED_SORT_KEYS as readonly string[]).includes(query.sort) ? query.sort as DerivedSortKey : null;
  if (derivedKey) {
    const direction = query.order === "asc" ? 1 : -1;
    scored.sort((a, b) => (a[derivedKey] - b[derivedKey]) * direction);
  }

  const total = scored.length;
  const page = clampPage(query, total);
  const pageIds = scored.slice((page - 1) * query.pageSize, page * query.pageSize).map((row) => row.id);

  const rows = await prisma.bundle.findMany({ where: { id: { in: pageIds } }, select: listSelect });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const items = pageIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toBundleListItem(row)] : [];
  });

  const response = paginate(items, page, query.pageSize, total);
  return truncated ? { ...response, truncated: true } : response;
}

/**
 * Filter options for the list screen. Dictionaries are small and change rarely,
 * so they are cached: without this every navigation to /bundles blocks on three
 * queries and Next reports it as uncached data during navigation.
 *
 * `facets` is the tag to invalidate (`updateTag('facets')`) from the settings CRUD
 * in stage 6, so a renamed offer shows up in the filter immediately. The getter is
 * exported rather than the cached function to keep the cache entry unparameterised.
 */
export async function getBundleFacets(): Promise<BundleFacets> {
  return loadFacets();
}

async function loadFacets(): Promise<BundleFacets> {
  "use cache";
  cacheTag("facets");
  cacheLife("minutes");

  const [offers, buyers, geos] = await Promise.all([
    prisma.offer.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.geo.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);

  return {
    offers: offers.map(option),
    buyers: buyers.map(option),
    geos: geos.map((geo) => ({ id: geo.id, label: geo.code })),
  };
}

/** Every row the current filters match, for CSV export. */
export async function listAllBundles(query: BundleQuery, currentUserId: string): Promise<BundleListItem[]> {
  const first = await listBundles({ ...query, page: 1, pageSize: 100 }, currentUserId);
  const items = [...first.items];

  for (let page = 2; page <= Math.min(first.pageCount, Math.ceil(EXPORT_LIMIT / 100)); page++) {
    const next = await listBundles({ ...query, page, pageSize: 100 }, currentUserId);
    items.push(...next.items);
  }

  return items.slice(0, EXPORT_LIMIT);
}

type ChangeRecord = {
  bundleId: string;
  userId: string;
  field: string;
  oldValue: string | null;
  newValue: string;
};

/**
 * Applies a bulk action to the rows the caller may manage and logs one
 * BundleChange per modified field, so the detail timeline in stage 5 has data
 * even for changes made from the list.
 */
export async function applyBulkBundles(user: CurrentUser, payload: BulkBundleForm) {
  const rows = await prisma.bundle.findMany({
    where: { id: { in: payload.ids } },
    select: { id: true, userId: true, status: true, isArchived: true },
  });

  if (rows.length === 0) throw notFound("No matching bundles");
  if (payload.action === "delete" && !isAdmin(user)) throw forbidden("Only an admin can delete bundles");

  const allowed = rows.filter((row) => canManageBundle(user, row));

  const changes: ChangeRecord[] = [];
  const operations: Prisma.PrismaPromise<unknown>[] = [];

  if (payload.action === "status") {
    const target = payload.status as BundleStatus;
    const affected = allowed.filter((row) => row.status !== target);
    for (const row of affected) {
      changes.push({ bundleId: row.id, userId: user.id, field: "status", oldValue: row.status, newValue: target });
    }
    if (affected.length > 0) {
      operations.push(prisma.bundle.updateMany({ where: { id: { in: affected.map((row) => row.id) } }, data: { status: target } }));
    }
    return finish(operations, changes, payload.ids.length, affected.length);
  }

  if (payload.action === "delete") {
    const ids = allowed.map((row) => row.id);
    // BundleChange and Comment cascade from the bundle, so no manual cleanup.
    operations.push(prisma.bundle.deleteMany({ where: { id: { in: ids } } }));
    return finish(operations, changes, payload.ids.length, ids.length);
  }

  const isArchived = payload.action === "archive";
  const affected = allowed.filter((row) => row.isArchived !== isArchived);
  for (const row of affected) {
    changes.push({
      bundleId: row.id,
      userId: user.id,
      field: "isArchived",
      oldValue: String(row.isArchived),
      newValue: String(isArchived),
    });
  }
  if (affected.length > 0) {
    operations.push(prisma.bundle.updateMany({ where: { id: { in: affected.map((row) => row.id) } }, data: { isArchived } }));
  }

  return finish(operations, changes, payload.ids.length, affected.length);
}

async function finish(operations: Prisma.PrismaPromise<unknown>[], changes: ChangeRecord[], requested: number, affected: number) {
  if (changes.length > 0) {
    operations.push(
      prisma.bundleChange.createMany({
        data: changes.map((change) => ({ ...change, createdAt: new Date() })),
      }),
    );
  }
  if (operations.length > 0) await prisma.$transaction(operations);

  // Every write here moves the numbers on the dashboard, which is cached under
  // this tag. Invalidating in one place covers the bulk endpoint and the single
  // PATCH alike, so a caller cannot forget it.
  if (affected > 0) revalidateTag("dashboard", { expire: 0 });

  return { affected, skipped: requested - affected };
}

/** Single-row status change, the endpoint the spec lists as PATCH /api/bundles/[id]/status. */
export async function setBundleStatus(user: CurrentUser, id: string, status: BundleStatus) {
  const row = await prisma.bundle.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true },
  });
  if (!row) throw notFound("Bundle not found");
  if (!canManageBundle(user, row)) throw forbidden("Only the owner or an admin can change this bundle");

  await applyBulkBundles(user, { action: "status", ids: [row.id], status });
  return { id: row.id, status };
}
