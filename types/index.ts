import type { BundleStatus } from "@/lib/generated/prisma/enums";
import type { DayPoint } from "@/lib/dashboard";

/** Wire shapes shared by the bundle API, the server pages and the client hooks. */

export type Option = { id: string; label: string };

/**
 * Dates are ISO strings on the wire: a `Date` cannot cross the route-handler
 * boundary, and keeping the DTO string-typed stops the client from pretending
 * otherwise.
 */
export type BundleListItem = {
  id: string;
  name: string;
  status: BundleStatus;
  angle: string;
  creative: string | null;
  budgetPlanned: number;
  budgetSpent: number;
  revenue: number;
  clicks: number;
  conversions: number;
  notes: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  offer: Option;
  buyer: Option;
  geos: Option[];
  tags: (Option & { color: string })[];
  /** Derived on the server so the table, the CSV and the charts agree. */
  cr: number;
  roi: number;
  profit: number;
};

export type BundlesResponse = {
  items: BundleListItem[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  /** Set when the ROI filter/sort had to scan more rows than it is willing to. */
  truncated?: boolean;
};

export type BundleFacets = {
  offers: Option[];
  buyers: Option[];
  geos: Option[];
  tags: (Option & { color: string })[];
};

export type BulkActionKind = "status" | "archive" | "unarchive" | "delete";

export type BulkResult = {
  affected: number;
  skipped: number;
};

/**
 * One row of the detail page's activity feed. `BundleChange` and `Comment` are
 * different tables with different payloads, so the feed carries the union and
 * `kind` decides which fields are meaningful.
 */
export type BundleActivityEntry = {
  id: string;
  kind: "change" | "comment";
  at: string;
  actor: Option;
  /**
   * Machine key of the field that moved ("status", "budgetPlanned", …), never a
   * display string: the seed, the edit form and the bulk action all write these
   * keys, and `lib/timeline.ts` turns them into words. Null for comments.
   */
  field: string | null;
  /** Raw stored value; rendered through the field's formatter. */
  oldValue: string | null;
  newValue: string | null;
  /** Comment body. */
  text: string | null;
};

export type BundleDetail = BundleListItem & {
  /** Oldest first, changes and comments interleaved — the GitHub issue order. */
  activity: BundleActivityEntry[];
  /** Daily spend/revenue/profit for this bundle, zero-filled over the window. */
  daily: DayPoint[];
  /** Computed server-side from the *requesting* user; the UI only reads it, every write re-checks. */
  permissions: { canManage: boolean; canDelete: boolean };
};

export type CreatedComment = {
  id: string;
  text: string;
  createdAt: string;
  author: Option;
};
