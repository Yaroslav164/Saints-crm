import { STATUS_META } from "@/lib/status";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { BundleStatus } from "@/lib/generated/prisma/enums";

/**
 * The change log stores `field` as a machine key and values as plain strings, so
 * three writers (the seed, the edit form and the bulk action) can share one
 * vocabulary while the page renders words. Everything human-readable is derived
 * here, at render time — nothing here touches the database, so the client can
 * import it too.
 *
 * Unknown keys fall through to their own name instead of disappearing: a field
 * added by a later stage must stay visible in history even before it is described.
 */

type FieldDescriptor = {
  label: string;
  /** Renders a stored string as a reader expects to see it. */
  show: (value: string) => string;
  /** The "bundle" row is the creation event, not a field edit. */
  event?: "created";
};

const asText = (value: string) => value || "—";

function asStatus(value: string): string {
  // The seed and the bulk endpoint store the enum key, the form stores the label;
  // both must render identically.
  return value in STATUS_META ? `${STATUS_META[value as BundleStatus].emoji} ${STATUS_META[value as BundleStatus].label}` : value;
}

function asMoney(value: string): string {
  const number = Number(value);
  return Number.isFinite(number) ? formatCurrency(number) : value;
}

function asCount(value: string): string {
  const number = Number(value);
  return Number.isFinite(number) ? formatNumber(number) : value;
}

const FIELDS: Record<string, FieldDescriptor> = {
  bundle: { label: "bundle", show: () => "created this bundle", event: "created" },
  name: { label: "name", show: asText },
  status: { label: "status", show: asStatus },
  offer: { label: "offer", show: asText },
  buyer: { label: "buyer", show: asText },
  angle: { label: "angle", show: asText },
  creative: { label: "creative", show: asText },
  geos: { label: "GEO", show: asText },
  tags: { label: "tags", show: asText },
  budgetPlanned: { label: "planned budget", show: asMoney },
  budgetSpent: { label: "spent", show: asMoney },
  revenue: { label: "revenue", show: asMoney },
  clicks: { label: "clicks", show: asCount },
  conversions: { label: "conversions", show: asCount },
  notes: { label: "notes", show: asText },
  isArchived: { label: "archive", show: (value) => (value === "true" ? "archived" : "active") },
  // Written by the CSV importer instead of `bundle`, so a bulk load reads as a load.
  import: { label: "import", show: () => "imported this bundle", event: "created" },
};

/**
 * The vocabulary in the order a reader would expect to see it — form order, not
 * alphabetical. The audit screen offers these as filter options and puts anything it finds
 * in the log that is not listed here after them, so a field key from a future stage is
 * filterable the day it first appears.
 */
export const FIELD_KEYS = Object.keys(FIELDS);

/**
 * Display name of a field key. An unknown one prints itself: the audit filter has to be
 * able to name a key it found in the log even before anyone wrote a label for it.
 */
export function fieldLabel(field: string): string {
  return FIELDS[field]?.label ?? field;
}

export type DescribedChange = {
  label: string;
  /** Already rendered for the field's type, or null when there was no previous value. */
  from: string | null;
  to: string;
  isCreation: boolean;
  /** Status moves get their own visual weight; the rest are compact rows. */
  isStatus: boolean;
};

export function describeChange(field: string, oldValue: string | null, newValue: string | null): DescribedChange {
  const descriptor = FIELDS[field];
  const to = descriptor ? descriptor.show(newValue ?? "") : (newValue ?? "—");
  const from = descriptor && oldValue !== null && oldValue !== "" ? descriptor.show(oldValue) : null;

  return {
    label: descriptor?.label ?? field,
    from,
    to,
    isCreation: descriptor?.event === "created",
    isStatus: field === "status",
  };
}
