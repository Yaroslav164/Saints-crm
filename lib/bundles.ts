import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { syncRoiAlerts } from "@/lib/notifications";
import { canManageBundle, isAdmin, type CurrentUser } from "@/lib/dal";
import { forbidden, notFound } from "@/lib/http";
import { calculateCR, calculateProfit, calculateROI, roundTo, formatDayKey, formatDayLabel } from "@/lib/utils";
import type { BundleForm, BundleUpdateForm, BulkBundleForm, BundleQuery } from "@/lib/validations";
import type { BundleActivityEntry, BundleDetail, BundleFacets, BundleListItem, BundlesResponse, CreatedComment, Option } from "@/types";
import type { DayPoint } from "@/lib/dashboard";
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
  notes: true,
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
    notes: row.notes,
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

  const [offers, buyers, geos, tags] = await Promise.all([
    prisma.offer.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.geo.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
  ]);

  return {
    offers: offers.map(option),
    buyers: buyers.map(option),
    geos: geos.map((geo) => ({ id: geo.id, label: geo.code })),
    tags: tags.map((tag) => ({ id: tag.id, label: tag.name, color: tag.color })),
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

  // The ROI alerts are derived from these same rows, so they are recomputed here too —
  // archiving a losing bundle clears its alert, unarchiving it raises one again, and a
  // status change that came with new numbers is checked against the current threshold.
  // Reading the ids back off `changes` covers every bulk action, because each one that
  // moves a value writes a row; a delete needs nothing, its alerts cascade with it.
  if (affected > 0) await syncRoiAlerts([...new Set(changes.map((change) => change.bundleId))]);

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

/**
 * Fields the edit form can change, keyed by the machine name written to
 * `BundleChange.field`. The keys are shared with the seed and the bulk action, and
 * `lib/timeline.ts` owns the words they turn into — including values logged by name
 * instead of id, because a timeline reading "offer: clo_1a2b" tells nobody anything.
 */
const LOGGED_FIELDS = [
  { label: "name", show: (item: BundleListItem) => item.name },
  { label: "status", show: (item: BundleListItem) => item.status },
  { label: "offer", show: (item: BundleListItem) => item.offer.label },
  { label: "buyer", show: (item: BundleListItem) => item.buyer.label },
  { label: "angle", show: (item: BundleListItem) => item.angle },
  { label: "creative", show: (item: BundleListItem) => item.creative ?? "" },
  { label: "geos", show: (item: BundleListItem) => item.geos.map((geo) => geo.label).join(", ") },
  { label: "tags", show: (item: BundleListItem) => item.tags.map((tag) => tag.label).join(", ") },
  { label: "budgetPlanned", show: (item: BundleListItem) => String(item.budgetPlanned) },
  { label: "budgetSpent", show: (item: BundleListItem) => String(item.budgetSpent) },
  { label: "revenue", show: (item: BundleListItem) => String(item.revenue) },
  { label: "clicks", show: (item: BundleListItem) => String(item.clicks) },
  { label: "conversions", show: (item: BundleListItem) => String(item.conversions) },
  { label: "notes", show: (item: BundleListItem) => item.notes ?? "" },
] as const;

function diffBundle(before: BundleListItem, after: BundleListItem) {
  return LOGGED_FIELDS.flatMap((field) => {
    const oldValue = field.show(before);
    const newValue = field.show(after);
    return oldValue === newValue ? [] : [{ field: field.label, oldValue, newValue }];
  });
}

/** Creates a bundle. A buyer always owns their own row; only an admin may assign one. */
export async function createBundle(user: CurrentUser, data: BundleForm): Promise<BundleListItem> {
  const userId = data.userId && isAdmin(user) ? data.userId : user.id;

  // Interactive transaction so the row and its "created" history entry commit
  // together. It does NOT silence the pg "already executing a query"
  // deprecation — that comes from inside the Prisma engine's own plan
  // interpreter (client.js → performIO → pg Client.query), not from here.
  const created = await prisma.$transaction(async (tx) => {
    const bundle = await tx.bundle.create({
      data: {
        name: data.name,
        offerId: data.offerId,
        angle: data.angle,
        creative: data.creative || null,
        status: data.status,
        budgetPlanned: data.budgetPlanned,
        budgetSpent: data.budgetSpent,
        revenue: data.revenue,
        clicks: data.clicks,
        conversions: data.conversions,
        notes: data.notes || null,
        userId,
        geos: { connect: data.geoIds.map((geoId) => ({ id: geoId })) },
        tags: { connect: data.tagIds.map((tagId) => ({ id: tagId })) },
      },
      select: listSelect,
    });

    await tx.bundleChange.create({
      data: { bundleId: bundle.id, userId: user.id, field: "bundle", oldValue: null, newValue: "created" },
    });

    return bundle;
  });

  revalidateTag("dashboard", { expire: 0 });
  // A bundle can be created already under the line — $500 spent against $300 revenue is
  // the common case for a row that was tested elsewhere first and logged afterwards.
  await syncRoiAlerts([created.id]);

  return toBundleListItem(created);
}

/** Updates a bundle and writes one BundleChange per modified field. */
export async function updateBundle(user: CurrentUser, id: string, patch: BundleUpdateForm): Promise<BundleListItem> {
  const before = await prisma.bundle.findUnique({ where: { id }, select: listSelect });
  if (!before) throw notFound("Bundle not found");
  if (!canManageBundle(user, { userId: before.user.id })) {
    throw forbidden("Only the owner or an admin can edit this bundle");
  }
  if (patch.userId && patch.userId !== before.user.id && !isAdmin(user)) {
    throw forbidden("Only an admin can reassign a bundle");
  }

  // One transaction so the update and its per-field history cannot be split by a
  // failure in between.
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.bundle.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.offerId !== undefined ? { offerId: patch.offerId } : {}),
        ...(patch.angle !== undefined ? { angle: patch.angle } : {}),
        ...(patch.creative !== undefined ? { creative: patch.creative || null } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.budgetPlanned !== undefined ? { budgetPlanned: patch.budgetPlanned } : {}),
        ...(patch.budgetSpent !== undefined ? { budgetSpent: patch.budgetSpent } : {}),
        ...(patch.revenue !== undefined ? { revenue: patch.revenue } : {}),
        ...(patch.clicks !== undefined ? { clicks: patch.clicks } : {}),
        ...(patch.conversions !== undefined ? { conversions: patch.conversions } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes || null } : {}),
        ...(patch.userId !== undefined ? { userId: patch.userId } : {}),
        ...(patch.geoIds !== undefined ? { geos: { set: patch.geoIds.map((geoId) => ({ id: geoId })) } } : {}),
        ...(patch.tagIds !== undefined ? { tags: { set: patch.tagIds.map((tagId) => ({ id: tagId })) } } : {}),
      },
      select: listSelect,
    });

    const changes = diffBundle(toBundleListItem(before), toBundleListItem(row));
    if (changes.length > 0) {
      await tx.bundleChange.createMany({
        data: changes.map((change) => ({ ...change, bundleId: id, userId: user.id, createdAt: new Date() })),
      });
    }

    return row;
  });

  revalidateTag("dashboard", { expire: 0 });
  // The numbers moved here, so this is where a bundle crosses the alert line in either
  // direction: raised when it falls under, cleared when the correction got it back over.
  await syncRoiAlerts([updated.id]);

  return toBundleListItem(updated);
}

/** Daily rows are read newest-last and capped, so a long-lived bundle stays a readable chart. */
const DAILY_WINDOW_DAYS = 30;

const detailSelect = {
  ...listSelect,
  changes: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      field: true,
      oldValue: true,
      newValue: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
    },
  },
  comments: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      text: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
    },
  },
  metrics: {
    orderBy: { date: "asc" },
    select: { date: true, spent: true, revenue: true },
  },
} satisfies Prisma.BundleSelect;

type BundleDetailRow = Prisma.BundleGetPayload<{ select: typeof detailSelect }>;

/**
 * The feed interleaves the two tables the page reads: one entry per logged field
 * change and one per comment, oldest first. Comments are not written into
 * `BundleChange` as well — a row in one place cannot drift out of sync with the
 * thread it came from.
 */
function buildActivity(row: BundleDetailRow): BundleActivityEntry[] {
  const changes: BundleActivityEntry[] = row.changes.map((change) => ({
    id: change.id,
    kind: "change",
    at: change.createdAt.toISOString(),
    actor: { id: change.user.id, label: change.user.name },
    field: change.field,
    oldValue: change.oldValue,
    newValue: change.newValue,
    text: null,
  }));

  const comments: BundleActivityEntry[] = row.comments.map((comment) => ({
    id: comment.id,
    kind: "comment",
    at: comment.createdAt.toISOString(),
    actor: { id: comment.user.id, label: comment.user.name },
    field: null,
    oldValue: null,
    newValue: null,
    text: comment.text,
  }));

  return [...changes, ...comments].sort((a, b) => a.at.localeCompare(b.at));
}

function toDayPoint(row: { date: Date; spent: number; revenue: number }): DayPoint {
  const spent = roundTo(row.spent);
  const revenue = roundTo(row.revenue);
  return {
    day: formatDayKey(row.date),
    label: formatDayLabel(row.date),
    revenue,
    spent,
    profit: roundTo(calculateProfit(revenue, spent)),
  };
}

/**
 * Everything the detail page needs in one read. `permissions` is computed from the
 * caller rather than sent by the client: the UI only decides which buttons to draw,
 * and every write endpoint checks the same rules again on its own.
 */
export async function readBundleDetail(user: CurrentUser, id: string): Promise<BundleDetail | null> {
  const row = await prisma.bundle.findUnique({ where: { id }, select: detailSelect });
  if (!row) return null;

  return {
    ...toBundleListItem(row),
    activity: buildActivity(row),
    daily: row.metrics.map(toDayPoint).slice(-DAILY_WINDOW_DAYS),
    permissions: {
      canManage: canManageBundle(user, { userId: row.user.id }),
      canDelete: isAdmin(user),
    },
  };
}

/** API-facing variant: a missing row is a 404 rather than a null the page must handle. */
export async function getBundleDetail(user: CurrentUser, id: string): Promise<BundleDetail> {
  const detail = await readBundleDetail(user, id);
  if (!detail) throw notFound("Bundle not found");
  return detail;
}

/**
 * Adds a team comment. It goes in without touching `Bundle.updatedAt`: a note is
 * not a data change, and letting it move "Updated" would make the list column lie
 * about when the numbers last moved.
 */
export async function addBundleComment(user: CurrentUser, id: string, text: string): Promise<CreatedComment> {
  const bundle = await prisma.bundle.findUnique({ where: { id }, select: { id: true } });
  if (!bundle) throw notFound("Bundle not found");

  const comment = await prisma.comment.create({
    data: { bundleId: id, userId: user.id, text },
    select: { id: true, text: true, createdAt: true, user: { select: { id: true, name: true } } },
  });

  return {
    id: comment.id,
    text: comment.text,
    createdAt: comment.createdAt.toISOString(),
    author: { id: comment.user.id, label: comment.user.name },
  };
}

/**
 * Hard delete, admins only — the same rule as the bulk endpoint, so "Delete" cannot
 * mean one thing in the list and another on the page. BundleChange, Comment,
 * BundleMetric and Notification all cascade from the bundle.
 */
export async function deleteBundle(user: CurrentUser, id: string): Promise<{ id: string; name: string }> {
  const row = await prisma.bundle.findUnique({ where: { id }, select: { id: true, name: true, userId: true } });
  if (!row) throw notFound("Bundle not found");
  if (!isAdmin(user)) throw forbidden("Only an admin can delete bundles");

  await prisma.bundle.delete({ where: { id } });
  revalidateTag("dashboard", { expire: 0 });

  return { id: row.id, name: row.name };
}
