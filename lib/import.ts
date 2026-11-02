import { prisma } from "@/lib/db";
import { normaliseHeader, parseAmount, parseCsv, splitMulti } from "@/lib/csv";
import { ApiError } from "@/lib/http";
import { syncRoiAlerts } from "@/lib/notifications";
import { STATUS_META, STATUS_ORDER } from "@/lib/status";
import { isAdmin, type CurrentUser } from "@/lib/dal";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { IMPORT_MAX_ROWS, bundleSchema, fieldErrors, type BundleForm } from "@/lib/validations";
import type { BundleStatus } from "@/lib/generated/prisma/enums";
import type { ImportResult, ImportRowOutcome } from "@/types";

/**
 * CSV import of bundles (stage 7).
 *
 * The column vocabulary is the export's, so a file downloaded from `/api/bundles/export`
 * can be edited and handed back — the round trip is the only import contract a team can
 * actually keep. Reading a column the export writes as a derived number (`CR %`, `ROI %`,
 * `Profit`) is accepted and ignored rather than refused, because those headers come from
 * our own file; `columns.ignored` reports what was dropped so nothing disappears silently.
 *
 * Deliberately not a path into the dictionaries: an unknown offer or GEO code fails the
 * row with a message naming the Settings tab that fixes it. Creating a dictionary entry as
 * a side effect of a spreadsheet would let one bad file invent the team's taxonomy — and
 * `Offer.payoutUSD`, the number every ROI judgement leans on, is not something a CSV row
 * can answer.
 */

/** The limits are declared with the schemas and re-exported for the route that reports them. */
export { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, IMPORT_MAX_LABEL } from "@/lib/validations";

type ColumnKey =
  | "name"
  | "offer"
  | "angle"
  | "geos"
  | "buyer"
  | "status"
  | "budgetPlanned"
  | "budgetSpent"
  | "revenue"
  | "clicks"
  | "conversions"
  | "tags"
  | "notes"
  | "creative";

type Column = { key: ColumnKey; header: string; aliases: string[]; required: boolean; hint: string };

const COLUMNS: Column[] = [
  { key: "name", header: "Name", aliases: ["name", "bundle name", "title"], required: true, hint: "Dating US - Video v1 - TikTok" },
  { key: "offer", header: "Offer", aliases: ["offer", "offer name"], required: true, hint: "Dating Smartlink US" },
  { key: "angle", header: "Angle", aliases: ["angle", "approach"], required: true, hint: "Unread-message lander" },
  { key: "geos", header: "GEOs", aliases: ["geos", "geo", "countries"], required: true, hint: "US DE" },
  { key: "buyer", header: "Buyer", aliases: ["buyer", "owner", "user"], required: false, hint: "ivanov@saints.com" },
  { key: "status", header: "Status", aliases: ["status", "state"], required: true, hint: "TESTING" },
  { key: "budgetPlanned", header: "Budget planned", aliases: ["budget planned", "planned", "planned budget"], required: false, hint: "500" },
  { key: "budgetSpent", header: "Spent", aliases: ["spent", "budget spent"], required: false, hint: "200" },
  { key: "revenue", header: "Revenue", aliases: ["revenue", "earnings"], required: false, hint: "300" },
  { key: "clicks", header: "Clicks", aliases: ["clicks"], required: false, hint: "5000" },
  { key: "conversions", header: "Conversions", aliases: ["conversions", "conv", "actions"], required: false, hint: "25" },
  { key: "tags", header: "Tags", aliases: ["tags", "tag"], required: false, hint: "hot proven" },
  { key: "notes", header: "Notes", aliases: ["notes", "note"], required: false, hint: "Free text" },
  { key: "creative", header: "Creative", aliases: ["creative", "creative url"], required: false, hint: "https://example.com/creative" },
];

/** Written by the export, computed by the app — read from a file they are ignored, not trusted. */
const DERIVED_HEADERS = ["cr", "cr%", "roi", "roi%", "profit", "created", "updated"];

/** Header of the template and of the export, in one place so they cannot drift apart. */
export const IMPORT_HEADERS = COLUMNS.map((column) => column.header);

/**
 * Status words a file can contain: the enum key the form uses, the label the export
 * writes ("In profit"), and the label with its emoji — which `normaliseHeader` reduces to
 * the label anyway, so both spellings land on the same entry.
 */
const STATUS_LOOKUP = new Map<string, BundleStatus>();
for (const status of STATUS_ORDER) {
  STATUS_LOOKUP.set(normaliseHeader(status), status);
  STATUS_LOOKUP.set(normaliseHeader(STATUS_META[status].label), status);
}

type ColumnMatch = { index: Partial<Record<ColumnKey, number>>; matched: string[]; ignored: string[]; missing: string[] };

function matchColumns(headers: string[]): ColumnMatch {
  const index: Partial<Record<ColumnKey, number>> = {};
  const matched: string[] = [];
  const ignored: string[] = [];

  headers.forEach((header, position) => {
    const key = normaliseHeader(header);
    if (key === "") return;

    const column = COLUMNS.find((item) => item.aliases.some((alias) => normaliseHeader(alias) === key));
    if (column && index[column.key] === undefined) {
      index[column.key] = position;
      matched.push(column.header);
      return;
    }

    if (DERIVED_HEADERS.includes(key)) {
      ignored.push(header);
      return;
    }

    // An unrecognised header is reported rather than silently dropped: the alternative is
    // a team importing a file where half their column was never read.
    ignored.push(header);
  });

  const missing = COLUMNS.filter((column) => column.required && index[column.key] === undefined).map(
    (column) => column.header,
  );

  return { index, matched, ignored, missing };
}

/** Dictionaries are read once per file: a row-by-row lookup would be one query per cell. */
async function loadDictionaries() {
  const [offers, geos, tags, users] = await Promise.all([
    prisma.offer.findMany({ select: { id: true, name: true, isActive: true } }),
    prisma.geo.findMany({ select: { id: true, code: true } }),
    prisma.tag.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true, isActive: true } }),
  ]);

  const offersByName = new Map(offers.map((offer) => [normaliseHeader(offer.name), offer]));
  const geosByCode = new Map(geos.map((geo) => [geo.code.toUpperCase(), geo]));
  const tagsByName = new Map(tags.map((tag) => [normaliseHeader(tag.name), tag]));
  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));

  // Names are how the export writes a buyer, but a name is not unique in the schema, so a
  // collision is recorded here and answered with "use their email" rather than by picking
  // one of them — silently importing work onto the wrong person is not a choice to make.
  const usersByName = new Map<string, { user: (typeof users)[number]; matches: number; emails: string[] }>();
  for (const user of users) {
    const key = normaliseHeader(user.name);
    const seen = usersByName.get(key);
    usersByName.set(key, {
      user,
      matches: (seen?.matches ?? 0) + 1,
      emails: [...(seen?.emails ?? []), user.email],
    });
  }

  return { offersByName, geosByCode, tagsByName, usersByEmail, usersByName };
}

type Dictionary = Awaited<ReturnType<typeof loadDictionaries>>;

function cellOf(row: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return (row[index] ?? "").trim();
}

/** The spreadsheet line a row came from — the header is line 1, so the first record is line 2. */
const lineOf = (rowNumber: number) => rowNumber + 1;

function resolveRow(row: string[], match: ColumnMatch, dictionaries: Dictionary, user: CurrentUser) {
  const errors: Record<string, string> = {};
  const cell = (key: ColumnKey) => cellOf(row, match.index[key]);

  const offerName = cell("offer");
  const offer = offerName ? dictionaries.offersByName.get(normaliseHeader(offerName)) : undefined;
  if (!offerName) errors.offer = "Offer is empty";
  else if (!offer) errors.offer = `Offer “${offerName}” is not in the dictionary — add it in Settings → Offers first`;
  else if (!offer.isActive) errors.offer = `Offer “${offerName}” is deactivated — activate it in Settings or pick another`;

  const geoCodes = splitMulti(cell("geos"));
  const geoIds: string[] = [];
  if (geoCodes.length === 0) errors.geos = "GEOs is empty — list at least one code, e.g. US";
  for (const code of geoCodes) {
    const geo = dictionaries.geosByCode.get(code.toUpperCase());
    if (!geo) {
      errors.geos = `GEO “${code}” is not in the dictionary — add it in Settings → GEOs first`;
      break;
    }
    geoIds.push(geo.id);
  }

  const tagNames = splitMulti(cell("tags"));
  const tagIds: string[] = [];
  for (const name of tagNames) {
    const tag = dictionaries.tagsByName.get(normaliseHeader(name));
    if (!tag) {
      errors.tags = `Tag “${name}” is not in the dictionary — add it in Settings → Tags first`;
      break;
    }
    tagIds.push(tag.id);
  }

  const statusText = cell("status");
  const status = statusText ? STATUS_LOOKUP.get(normaliseHeader(statusText)) : undefined;
  if (!statusText) errors.status = "Status is empty";
  else if (!status) errors.status = `Unknown status “${statusText}” — use one of ${STATUS_ORDER.join(", ")}`;

  // A buyer may only import for themselves; the same rule as `createBundle`, so a file
  // cannot put work on a colleague's name without being an admin.
  const buyerText = cell("buyer");
  let userId = user.id;
  if (buyerText) {
    const byEmail = dictionaries.usersByEmail.get(buyerText.toLowerCase());
    const byName = dictionaries.usersByName.get(normaliseHeader(buyerText));
    const resolved = byEmail ?? (byName && byName.matches === 1 ? byName.user : undefined);
    const label = byEmail?.email ?? (byName && byName.matches === 1 ? byName.user.name : buyerText);

    if (!resolved) {
      errors.buyer = byName
        ? `Buyer name “${buyerText}” matches several accounts (${byName.emails.join(", ")}) — use an email instead`
        : `Buyer “${buyerText}” is not a team account`;
    } else if (!isAdmin(user) && resolved.id !== user.id) {
      errors.buyer = `Only an admin can import bundles for another buyer (${label})`;
    } else if (!resolved.isActive) {
      // Reported separately from the assignment rule so a deactivated account is not
      // mistaken for a missing one.
      errors.buyer = `Buyer “${label}” is deactivated — they cannot be given new work`;
    } else {
      userId = resolved.id;
    }
  }

  const numbers: Record<string, number> = {};
  for (const key of ["budgetPlanned", "budgetSpent", "revenue", "clicks", "conversions"] as const) {
    const raw = cell(key);
    if (raw === "") {
      numbers[key] = 0;
      continue;
    }
    const parsed = parseAmount(raw);
    if (parsed === null) {
      errors[key] = `“${raw}” is not a number`;
      continue;
    }
    if (parsed < 0) {
      errors[key] = "Cannot be negative";
      continue;
    }
    if ((key === "clicks" || key === "conversions") && !Number.isInteger(parsed)) {
      errors[key] = "Whole numbers only";
      continue;
    }
    numbers[key] = parsed;
  }

  const ready = Object.keys(errors).length === 0;

  return {
    ready,
    errors,
    name: cell("name"),
    payload: {
      name: cell("name"),
      offerId: offer?.id ?? "",
      angle: cell("angle"),
      creative: cell("creative") || undefined,
      geoIds,
      tagIds,
      userId,
      status: status ?? "IDEA",
      budgetPlanned: numbers.budgetPlanned ?? 0,
      budgetSpent: numbers.budgetSpent ?? 0,
      revenue: numbers.revenue ?? 0,
      clicks: numbers.clicks ?? 0,
      conversions: numbers.conversions ?? 0,
      notes: cell("notes") || undefined,
    },
  };
}

export type ImportInput = { text: string; dryRun: boolean; skipInvalid: boolean };

/**
 * Validates the file and, unless it is a preview, writes what passed. Every row is
 * reported with its line number and the fields at fault, so a 200-row file that fails on
 * four of them is fixed in the spreadsheet instead of guessed at.
 */
export async function importBundles(user: CurrentUser, input: ImportInput): Promise<ImportResult> {
  const rows = parseCsv(input.text);
  if (rows.length < 2) throw new ApiError(400, "The file needs a header row and at least one data row");

  const [headers, ...records] = rows;
  const match = matchColumns(headers);

  if (match.missing.length > 0) {
    throw new ApiError(422, `Missing required columns: ${match.missing.join(", ")}`, {
      columns: match.missing.join(", "),
    });
  }
  if (records.length > IMPORT_MAX_ROWS) {
    throw new ApiError(413, `At most ${IMPORT_MAX_ROWS} rows per import — split the file`, {
      rows: String(records.length),
    });
  }

  const dictionaries = await loadDictionaries();

  const outcomes: ImportRowOutcome[] = [];
  const valid: BundleForm[] = [];

  records.forEach((record, position) => {
    const resolved = resolveRow(record, match, dictionaries, user);
    const errors: Record<string, string> = { ...resolved.errors };

    // The bundle schema is the single source of truth for the field rules, so the import
    // does not re-state "at least 3 characters". It runs only once the dictionary lookups
    // passed: an unresolved offer would arrive as `offerId: ""` and be reported twice —
    // once as "Required" instead of the message that names the Settings tab to fix.
    if (resolved.ready) {
      const parsed = bundleSchema.safeParse(resolved.payload);
      if (!parsed.success) Object.assign(errors, fieldErrors(parsed.error));
      else valid.push(parsed.data);
    }

    outcomes.push({
      line: lineOf(position),
      name: resolved.name || null,
      ok: Object.keys(errors).length === 0,
      errors,
    });
  });

  const invalid = outcomes.filter((outcome) => !outcome.ok).length;
  const aborted = !input.skipInvalid && invalid > 0;

  const base = {
    dryRun: input.dryRun,
    rows: records.length,
    invalid,
    aborted,
    columns: { matched: match.matched, ignored: match.ignored, missing: match.missing },
    outcomes,
  };

  if (input.dryRun || aborted) return { ...base, created: 0, skipped: aborted ? records.length : invalid };

  if (valid.length === 0) return { ...base, created: 0, skipped: invalid };

  const created = await writeRows(user, valid);

  // One invalidation for the whole file, and one alert pass over the new rows: both are
  // per-batch here, which is exactly why the write loop does not call `createBundle`.
  revalidateTag("dashboard", { expire: 0 });
  await syncRoiAlerts(created);

  return { ...base, created: valid.length, skipped: invalid };
}

/**
 * Nested creates (GEOs and tags are relations) inside one transaction, so a file either
 * lands completely or not at all — a half-imported spreadsheet is worse than a refused one,
 * because the natural reaction to a partial list is to import it again.
 */
async function writeRows(user: CurrentUser, rows: BundleForm[]): Promise<string[]> {
  const createdIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const payload of rows) {
      const bundle = await tx.bundle.create({
        data: {
          name: payload.name,
          offerId: payload.offerId,
          angle: payload.angle,
          creative: payload.creative || null,
          status: payload.status,
          budgetPlanned: payload.budgetPlanned,
          budgetSpent: payload.budgetSpent,
          revenue: payload.revenue,
          clicks: payload.clicks,
          conversions: payload.conversions,
          notes: payload.notes || null,
          userId: payload.userId ?? user.id,
          geos: { connect: payload.geoIds.map((id) => ({ id })) },
          tags: { connect: payload.tagIds.map((id) => ({ id })) },
        },
        select: { id: true },
      });

      await tx.bundleChange.create({
        data: { bundleId: bundle.id, userId: user.id, field: "import", oldValue: null, newValue: "imported" },
      });

      createdIds.push(bundle.id);
    }
  });

  return createdIds;
}

/** Header line of the import template, with the one example row the aliases describe. */
export function importTemplate(): { headers: string[]; example: string[] } {
  const example = COLUMNS.map((column) => column.hint);
  return { headers: IMPORT_HEADERS, example };
}

/**
 * The dictionary names a file may reference, for the dialog's hint list. Cached under the
 * same `facets` tag the filter options and the settings CRUD already share, so a new offer
 * appears in the import help as soon as it appears in the form.
 */
export async function getImportVocabulary(): Promise<{ offers: string[]; geos: string[]; tags: string[] }> {
  return loadVocabulary();
}

async function loadVocabulary(): Promise<{ offers: string[]; geos: string[]; tags: string[] }> {
  "use cache";
  cacheTag("facets");
  cacheLife("minutes");

  const [offers, geos, tags] = await Promise.all([
    prisma.offer.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } }),
    prisma.geo.findMany({ orderBy: { code: "asc" }, select: { code: true } }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  return { offers: offers.map((offer) => offer.name), geos: geos.map((geo) => geo.code), tags: tags.map((tag) => tag.name) };
}
