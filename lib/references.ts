import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { notFound, ApiError } from "@/lib/http";
import type { CurrentUser } from "@/lib/dal";
import type {
  GeoForm,
  GeoUpdateForm,
  OfferForm,
  OfferUpdateForm,
  SettingsForm,
  TagForm,
  TagUpdateForm,
  UserUpdateForm,
} from "@/lib/validations";
import type {
  AppSettings,
  GeoRecord,
  OfferRecord,
  RemovedRecord,
  TagRecord,
  UserRecord,
} from "@/types";

/**
 * Dictionaries the bundle form and filters are built from (stage 6): offers, GEOs,
 * tags, buyers, plus the team-wide alert threshold.
 *
 * Reads are open to any signed-in member — a buyer needs the offer list to create a
 * bundle — while every write is guarded by `requireApiAdmin()` in the route. What is
 * decided here instead is the shape of the data: which rows still reference the one
 * being removed, and which deletions would lock the team out of its own CRM.
 */

/**
 * Filter options are cached under `facets` and the dashboard aggregates under
 * `dashboard` — and the top-5 widget prints offer and buyer names out of that cache.
 * A renamed dictionary entry has to expire both, so both are expired on every
 * reference write rather than reasoned about per field. `expire: 0` because route
 * handlers cannot call `updateTag`.
 */
function invalidateReferences(): void {
  revalidateTag("facets", { expire: 0 });
  revalidateTag("dashboard", { expire: 0 });
}

const offerSelect = {
  id: true,
  name: true,
  url: true,
  payoutUSD: true,
  network: true,
  isActive: true,
  createdAt: true,
  _count: { select: { bundles: true } },
} as const;

type OfferRow = {
  id: string;
  name: string;
  url: string | null;
  payoutUSD: number;
  network: string | null;
  isActive: boolean;
  createdAt: Date;
  _count: { bundles: number };
};

function toOfferRecord(row: OfferRow): OfferRecord {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    payoutUSD: row.payoutUSD,
    network: row.network,
    isActive: row.isActive,
    bundleCount: row._count.bundles,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listOffers(): Promise<OfferRecord[]> {
  const rows = await prisma.offer.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: offerSelect,
  });
  return rows.map(toOfferRecord);
}

export async function createOffer(data: OfferForm): Promise<OfferRecord> {
  // A duplicate name is answered by `errorResponse` as 409 "name must be unique",
  // which is the same envelope the bundle routes use.
  const created = await prisma.offer.create({
    data: {
      name: data.name,
      url: data.url || null,
      payoutUSD: data.payoutUSD,
      network: data.network || null,
      isActive: data.isActive ?? true,
    },
    select: offerSelect,
  });
  invalidateReferences();
  return toOfferRecord(created);
}

export async function updateOffer(id: string, patch: OfferUpdateForm): Promise<OfferRecord> {
  const existing = await prisma.offer.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound("Offer not found");

  const updated = await prisma.offer.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.url !== undefined ? { url: patch.url || null } : {}),
      ...(patch.payoutUSD !== undefined ? { payoutUSD: patch.payoutUSD } : {}),
      ...(patch.network !== undefined ? { network: patch.network || null } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
    },
    select: offerSelect,
  });
  invalidateReferences();
  return toOfferRecord(updated);
}

/**
 * An offer with bundles cannot be deleted: `bundles.offerId` is a RESTRICT foreign key,
 * so the database would refuse and the user would read a constraint error. Deactivating
 * is the supported way to retire an offer — it leaves the dictionary and every past
 * bundle readable while dropping out of the form and the filters.
 */
export async function deleteOffer(id: string): Promise<RemovedRecord> {
  const row = await prisma.offer.findUnique({ where: { id }, select: { id: true, name: true, _count: { select: { bundles: true } } } });
  if (!row) throw notFound("Offer not found");
  if (row._count.bundles > 0) {
    throw new ApiError(409, `“${row.name}” is used by ${row._count.bundles} bundle${row._count.bundles === 1 ? "" : "s"} — deactivate it instead`);
  }

  await prisma.offer.delete({ where: { id } });
  invalidateReferences();
  return { id, label: row.name };
}

const geoSelect = { id: true, code: true, name: true, _count: { select: { bundles: true } } } as const;

type GeoRow = { id: string; code: string; name: string; _count: { bundles: number } };

function toGeoRecord(row: GeoRow): GeoRecord {
  return { id: row.id, code: row.code, name: row.name, bundleCount: row._count.bundles };
}

export async function listGeos(): Promise<GeoRecord[]> {
  const rows = await prisma.geo.findMany({ orderBy: { code: "asc" }, select: geoSelect });
  return rows.map(toGeoRecord);
}

export async function createGeo(data: GeoForm): Promise<GeoRecord> {
  const created = await prisma.geo.create({ data: { code: data.code, name: data.name }, select: geoSelect });
  invalidateReferences();
  return toGeoRecord(created);
}

export async function updateGeo(id: string, patch: GeoUpdateForm): Promise<GeoRecord> {
  const existing = await prisma.geo.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound("GEO not found");

  const updated = await prisma.geo.update({
    where: { id },
    data: {
      ...(patch.code !== undefined ? { code: patch.code } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
    },
    select: geoSelect,
  });
  invalidateReferences();
  return toGeoRecord(updated);
}

/**
 * Deleting a GEO is allowed even while bundles link it: the `_BundleToGeo` join table
 * cascades, so the links go and the bundles stay. The count is returned for the same
 * reason the dialog asks for confirmation — a bundle without a GEO is still valid, but
 * the next save will insist on picking one.
 */
export async function deleteGeo(id: string): Promise<RemovedRecord> {
  const row = await prisma.geo.findUnique({ where: { id }, select: geoSelect });
  if (!row) throw notFound("GEO not found");

  await prisma.geo.delete({ where: { id } });
  invalidateReferences();
  return { id, label: `${row.code} — ${row.name}`, unlinked: row._count.bundles };
}

const tagSelect = { id: true, name: true, color: true, _count: { select: { bundles: true } } } as const;

type TagRow = { id: string; name: string; color: string; _count: { bundles: number } };

function toTagRecord(row: TagRow): TagRecord {
  return { id: row.id, name: row.name, color: row.color, bundleCount: row._count.bundles };
}

export async function listTags(): Promise<TagRecord[]> {
  const rows = await prisma.tag.findMany({ orderBy: { name: "asc" }, select: tagSelect });
  return rows.map(toTagRecord);
}

export async function createTag(data: TagForm): Promise<TagRecord> {
  const created = await prisma.tag.create({ data: { name: data.name, color: data.color }, select: tagSelect });
  invalidateReferences();
  return toTagRecord(created);
}

export async function updateTag(id: string, patch: TagUpdateForm): Promise<TagRecord> {
  const existing = await prisma.tag.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound("Tag not found");

  const updated = await prisma.tag.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
    },
    select: tagSelect,
  });
  invalidateReferences();
  return toTagRecord(updated);
}

/** Tags are annotations, so removing one only unlinks it — the same cascade as GEOs. */
export async function deleteTag(id: string): Promise<RemovedRecord> {
  const row = await prisma.tag.findUnique({ where: { id }, select: tagSelect });
  if (!row) throw notFound("Tag not found");

  await prisma.tag.delete({ where: { id } });
  invalidateReferences();
  return { id, label: row.name, unlinked: row._count.bundles };
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  _count: { select: { bundles: true } },
} as const;

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
  isActive: boolean;
  createdAt: Date;
  _count: { bundles: number };
};

function toUserRecord(row: UserRow, currentUserId: string): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.isActive,
    bundleCount: row._count.bundles,
    createdAt: row.createdAt.toISOString(),
    isSelf: row.id === currentUserId,
  };
}

export async function listUsers(current: CurrentUser): Promise<UserRecord[]> {
  const rows = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: userSelect,
  });
  return rows.map((row) => toUserRecord(row, current.id));
}

/**
 * Refuses the two edits that would strand the team: signing yourself out of your own
 * admin access, and demoting or disabling the last admin. `authorize()` already blocks
 * a disabled account from signing in again, which is what makes the last-admin rule
 * matter — with one account left and it disabled, nobody could re-enable anything.
 */
async function assertAdminSurvives(row: UserRow, patch: { role?: "ADMIN" | "USER"; isActive?: boolean }): Promise<void> {
  const wouldLoseAdmin =
    row.role === "ADMIN" && row.isActive && (patch.role === "USER" || patch.isActive === false);
  if (!wouldLoseAdmin) return;

  const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
  if (activeAdmins <= 1) throw new ApiError(400, "This is the last admin account — promote someone else first");
}

export async function updateUser(current: CurrentUser, id: string, patch: UserUpdateForm): Promise<UserRecord> {
  const row = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!row) throw notFound("User not found");

  if (id === current.id && (patch.role === "USER" || patch.isActive === false)) {
    throw new ApiError(400, "You cannot remove your own access");
  }
  await assertAdminSurvives(row, patch);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.email !== undefined ? { email: patch.email.toLowerCase() } : {}),
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
    },
    select: userSelect,
  });
  invalidateReferences();
  return toUserRecord(updated, current.id);
}

/**
 * Accounts are only removable while they own nothing: `bundles.userId` is RESTRICT, and
 * a buyer's history must not vanish with their login. Comments, changes and notifications
 * do cascade, so a departed intern can be erased once their bundles are reassigned.
 */
export async function deleteUser(current: CurrentUser, id: string): Promise<RemovedRecord> {
  const row = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!row) throw notFound("User not found");
  if (id === current.id) throw new ApiError(400, "You cannot delete your own account");
  if (row._count.bundles > 0) {
    throw new ApiError(
      409,
      `${row.name} still owns ${row._count.bundles} bundle${row._count.bundles === 1 ? "" : "s"} — reassign or delete them first`,
    );
  }
  await assertAdminSurvives(row, { role: "USER" });

  await prisma.user.delete({ where: { id } });
  invalidateReferences();
  return { id, label: row.name };
}

const ROI_THRESHOLD_KEY = "roiAlertThreshold";

/**
 * The value the seed writes. A missing row is not an error: the screen has to show a
 * number, and a fresh database that skipped seeding behaves like the demo one.
 */
const DEFAULT_ROI_ALERT_THRESHOLD = -20;

export async function readSettings(): Promise<AppSettings> {
  const row = await prisma.setting.findUnique({ where: { key: ROI_THRESHOLD_KEY } });
  const value = row ? Number.parseFloat(row.value) : NaN;
  return { roiAlertThreshold: Number.isFinite(value) ? value : DEFAULT_ROI_ALERT_THRESHOLD };
}

export async function writeSettings(data: SettingsForm): Promise<AppSettings> {
  const value = String(data.roiAlertThreshold);
  await prisma.setting.upsert({
    where: { key: ROI_THRESHOLD_KEY },
    create: { key: ROI_THRESHOLD_KEY, value },
    update: { value },
  });
  return readSettings();
}
