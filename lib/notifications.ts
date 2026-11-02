import { prisma } from "@/lib/db";
import { readSettings } from "@/lib/references";
import { calculateROI } from "@/lib/utils";
import type { CurrentUser } from "@/lib/dal";
import type { NotificationDto, NotificationsResponse } from "@/types";

/**
 * ROI alerts (the bell in the header).
 *
 * The trigger is a *derived* number — ROI is revenue against spend, not a column — so an
 * alert can only be re-evaluated where those two columns were just written. That is why
 * `syncRoiAlerts` is called from the bundle write paths in `lib/bundles.ts` rather than
 * from a cron: the CRM has no scheduler, and a rule that only runs on a schedule would
 * tell the team about a loss hours after they caused it.
 *
 * Rows are stored, not computed on read, because a bell that recomputes on every poll
 * cannot answer "which alerts have I already seen" — the `readAt` column is the whole
 * feature, and it only means something on a row.
 */

export const ROI_ALERT_TYPE = "roi_alert";

/** Reads cap at this size; the bell is a list of what needs attention, not an archive. */
const NOTIFICATION_LIMIT = 50;

/**
 * Ceiling for the threshold recomputation. Past this many live bundles the alert set is
 * incomplete, which is the same honesty `DERIVED_SCAN_LIMIT` buys the ROI filter — a
 * number the team can see beats a list that silently lost rows.
 */
const ALERT_SCAN_LIMIT = 2_000;

function toNotificationDto(row: {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
  readAt: Date | null;
  bundle: { id: string; name: string } | null;
}): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    at: row.createdAt.toISOString(),
    read: row.readAt !== null,
    bundle: row.bundle ? { id: row.bundle.id, label: row.bundle.name } : null,
  };
}

const notificationSelect = {
  id: true,
  type: true,
  message: true,
  createdAt: true,
  readAt: true,
  bundle: { select: { id: true, name: true } },
} as const;

export async function listNotifications(user: CurrentUser, unreadOnly = false): Promise<NotificationsResponse> {
  const where = { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) };

  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      select: notificationSelect,
      orderBy: { createdAt: "desc" },
      take: NOTIFICATION_LIMIT,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return { items: rows.map(toNotificationDto), unread };
}

/**
 * Marks the caller's own rows. `ids` empty means "everything unread" — the bell offers
 * both, and the write is scoped to `userId` either way so one account cannot dismiss
 * another's alerts by guessing an id.
 */
export async function markNotificationsRead(user: CurrentUser, ids?: string[]): Promise<{ marked: number }> {
  const result = await prisma.notification.updateMany({
    where: {
      userId: user.id,
      readAt: null,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });

  return { marked: result.count };
}

/** Dismissal deletes the row: a read alert already stays in the list, so this is for noise. */
export async function removeNotification(user: CurrentUser, id: string): Promise<{ id: string }> {
  const row = await prisma.notification.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!row || row.userId !== user.id) {
    // Answered as if it were yours and is now gone: the list is private, and a 403 on a
    // foreign id would tell a caller that the id exists.
    return { id };
  }

  await prisma.notification.delete({ where: { id } });
  return { id };
}

/**
 * Brings the ROI alerts of the given bundles in line with the current threshold:
 * raises what is under the line and clears unread alerts for what recovered or was
 * archived. Read alerts are left alone — the bell's history is the reader's, and
 * deleting what somebody already looked at would only lose information.
 */
export async function syncRoiAlerts(bundleIds: string[]): Promise<void> {
  if (bundleIds.length === 0) return;

  const [threshold, rows] = await Promise.all([
    readSettings().then((settings) => settings.roiAlertThreshold),
    prisma.bundle.findMany({
      where: { id: { in: bundleIds } },
      select: { id: true, name: true, userId: true, budgetSpent: true, revenue: true, isArchived: true },
    }),
  ]);
  if (rows.length === 0) return;

  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  const adminIds = admins.map((admin) => admin.id);

  const flagged = rows
    .filter((row) => !row.isArchived && row.budgetSpent > 0)
    .map((row) => ({ row, roi: calculateROI(row.revenue, row.budgetSpent) }))
    .filter((item) => item.roi < threshold);

  // One read for the whole batch: without this, an import of 500 rows would ask the
  // database whether each recipient already has an alert.
  const existing = await prisma.notification.findMany({
    where: { type: ROI_ALERT_TYPE, readAt: null, bundleId: { in: rows.map((row) => row.id) } },
    select: { userId: true, bundleId: true },
  });
  const seen = new Set(existing.map((row) => `${row.userId}:${row.bundleId}`));

  const create: { userId: string; bundleId: string; type: string; message: string; createdAt: Date }[] = [];
  for (const { row, roi } of flagged) {
    for (const userId of new Set([row.userId, ...adminIds])) {
      if (seen.has(`${userId}:${row.id}`)) continue;
      create.push({
        userId,
        bundleId: row.id,
        type: ROI_ALERT_TYPE,
        message: `Bundle "${row.name}" ROI is ${roi.toFixed(1)}% — below the ${threshold}% threshold.`,
        createdAt: new Date(),
      });
    }
  }

  const recovered = rows
    .filter((row) => !flagged.some((item) => item.row.id === row.id))
    .map((row) => row.id);

  const operations: Promise<unknown>[] = [];
  if (create.length > 0) operations.push(prisma.notification.createMany({ data: create }));
  if (recovered.length > 0) {
    operations.push(
      prisma.notification.deleteMany({ where: { type: ROI_ALERT_TYPE, readAt: null, bundleId: { in: recovered } } }),
    );
  }

  await Promise.all(operations);
}

/**
 * Full recomputation, run when an admin moves the threshold. Without it the number in
 * Settings and the contents of the bell would disagree until every bundle was touched
 * again, and the admin who just changed the rule is exactly the person who would notice.
 *
 * Every unread alert is dropped and re-raised from the new line rather than patched:
 * an alert is fully derived from (bundle, threshold, recipient), so rebuilding is
 * simpler than reasoning about which stale ones still hold. Read alerts are untouched —
 * what somebody already dismissed is their history, not ours.
 */
export async function recomputeRoiAlerts(): Promise<{ alerts: number }> {
  await prisma.notification.deleteMany({ where: { type: ROI_ALERT_TYPE, readAt: null } });

  const rows = await prisma.bundle.findMany({
    where: { isArchived: false, budgetSpent: { gt: 0 } },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take: ALERT_SCAN_LIMIT,
  });

  await syncRoiAlerts(rows.map((row) => row.id));

  const alerts = await prisma.notification.count({ where: { type: ROI_ALERT_TYPE, readAt: null } });
  return { alerts };
}
