import { prisma } from "@/lib/db";
import { FIELD_KEYS } from "@/lib/timeline";
import type { AuditEntry, AuditFacets, AuditResponse } from "@/types";
import type { AuditQuery } from "@/lib/validations";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * The audit log: every change and every comment in the system, newest first.
 *
 * It reads the same two tables the bundle feed does (`BundleChange` and `Comment`), which
 * is what makes the log complete without a third write path — nothing has to remember to
 * record an event, the events are already the history. What it adds is the bundle a row
 * belongs to, because from the log's point of view that is the subject and the person is
 * only the author.
 *
 * Not cached, unlike the filter dictionaries: the log is exactly the screen an admin opens
 * to find out what happened *just now*, and a stale entry there is worse than a slow one.
 */

/**
 * The two tables cannot be joined into one ordered SQL result through Prisma, so each is
 * read newest-first over a window and merged here — the same trade-off the derived ROI
 * filter makes. Beyond the window the totals are the window's, and `truncated` says so
 * instead of pretending the page is the whole log.
 */
const AUDIT_SCAN_LIMIT = 500;

const entrySelect = {
  id: true,
  createdAt: true,
  field: true,
  oldValue: true,
  newValue: true,
  user: { select: { id: true, name: true } },
  bundle: { select: { id: true, name: true } },
} as const;

const commentSelect = {
  id: true,
  createdAt: true,
  text: true,
  user: { select: { id: true, name: true } },
  bundle: { select: { id: true, name: true } },
} as const;

function dateRange(query: AuditQuery): Prisma.DateTimeFilter | undefined {
  if (!query.dateFrom && !query.dateTo) return undefined;
  return {
    ...(query.dateFrom ? { gte: query.dateFrom } : {}),
    ...(query.dateTo ? { lte: query.dateTo } : {}),
  };
}

function bundleFilter(query: AuditQuery): Prisma.BundleWhereInput | undefined {
  const search = query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {};
  const id = query.bundleId ? { id: query.bundleId } : {};
  return Object.keys(search).length || Object.keys(id).length ? { ...search, ...id } : undefined;
}

export async function listAudit(query: AuditQuery): Promise<AuditResponse> {
  const range = dateRange(query);
  const bundle = bundleFilter(query);
  const direction = query.order === "asc" ? "asc" : "desc";

  const changeWhere: Prisma.BundleChangeWhereInput = {
    ...(query.actorId ? { userId: query.actorId } : {}),
    ...(query.field ? { field: query.field } : {}),
    ...(range ? { createdAt: range } : {}),
    ...(bundle ? { bundle } : {}),
  };

  const commentWhere: Prisma.CommentWhereInput = {
    ...(query.actorId ? { userId: query.actorId } : {}),
    ...(range ? { createdAt: range } : {}),
    ...(bundle ? { bundle } : {}),
  };

  const wantChanges = query.kind !== "comment";
  // A comment has no field, so it cannot satisfy a field filter — dropping the comment
  // query here is what keeps `?field=budgetSpent` from answering with rows that carry
  // nothing but a text.
  const wantComments = query.kind !== "change" && !query.field;
  const take = AUDIT_SCAN_LIMIT + 1;

  const [changeRows, commentRows] = await Promise.all([
    wantChanges
      ? prisma.bundleChange.findMany({
          where: changeWhere,
          select: entrySelect,
          orderBy: [{ createdAt: direction }, { id: "asc" }],
          take,
        })
      : Promise.resolve([]),
    wantComments
      ? prisma.comment.findMany({
          where: commentWhere,
          select: commentSelect,
          orderBy: [{ createdAt: direction }, { id: "asc" }],
          take,
        })
      : Promise.resolve([]),
  ]);

  const truncated = changeRows.length > AUDIT_SCAN_LIMIT || commentRows.length > AUDIT_SCAN_LIMIT;

  const merged: AuditEntry[] = [
    ...changeRows.slice(0, AUDIT_SCAN_LIMIT).map((row) => ({
      id: row.id,
      kind: "change" as const,
      at: row.createdAt.toISOString(),
      actor: { id: row.user.id, label: row.user.name },
      bundle: { id: row.bundle.id, label: row.bundle.name },
      field: row.field,
      oldValue: row.oldValue,
      newValue: row.newValue,
      text: null,
    })),
    ...commentRows.slice(0, AUDIT_SCAN_LIMIT).map((row) => ({
      id: row.id,
      kind: "comment" as const,
      at: row.createdAt.toISOString(),
      actor: { id: row.user.id, label: row.user.name },
      bundle: { id: row.bundle.id, label: row.bundle.name },
      field: null,
      oldValue: null,
      newValue: null,
      text: row.text,
    })),
  ].sort((a, b) => (direction === "asc" ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at)));

  const total = merged.length;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  // A page past the end is clamped, for the same reason the bundle list clamps: a shared
  // link outlives the data it pointed at.
  const page = Math.min(Math.max(1, query.page), pageCount);

  return {
    items: merged.slice((page - 1) * query.pageSize, page * query.pageSize),
    page,
    pageSize: query.pageSize,
    total,
    pageCount,
    truncated,
  };
}

/**
 * Filter options for the log. The field list is read from the log itself (`GROUP BY field`)
 * rather than from the vocabulary, so the dropdown can only ever offer something an admin
 * can actually filter; the vocabulary then decides the order, with any key that is not in
 * it — a field added later, or one written by an older build — listed after it.
 */
export async function getAuditFacets(): Promise<AuditFacets> {
  const [groups, users] = await Promise.all([
    prisma.bundleChange.groupBy({ by: ["field"], _count: { _all: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const keys = groups.map((group) => group.field);
  const known = FIELD_KEYS.filter((key) => keys.includes(key));
  const rest = keys.filter((key) => !FIELD_KEYS.includes(key)).sort();

  return { actors: users.map((user) => ({ id: user.id, label: user.name })), fields: [...known, ...rest] };
}
