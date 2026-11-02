import type { BundleStatus, Role } from "@/lib/generated/prisma/enums";
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

/**
 * Stage 6 — analytics and dictionaries. The analytics slices are the wire shape of
 * numbers the server already derived: the client draws charts and tables from these
 * fields and never recomputes a ROI, so the API answer and the chart cannot disagree.
 */

/** Inclusive UTC day bounds of an analytics period, plus the period before it. */
export type AnalyticsWindowDto = {
  from: string;
  to: string;
  days: number;
  previousFrom: string;
  previousTo: string;
};

/** Money/traffic totals over one dimension (team, buyer, offer or bundle). */
export type MetricSlice = {
  spent: number;
  revenue: number;
  profit: number;
  roi: number;
  clicks: number;
  conversions: number;
  cr: number;
  /** Number of bundles that contributed to this slice. */
  bundles: number;
};

export type BuyerSlice = MetricSlice & { buyer: Option };

export type OfferSlice = MetricSlice & {
  offer: Option;
  /** Standard payout from the dictionary, as context for the offer's CR. */
  payoutUSD: number;
};

/**
 * One step of the status funnel. `share` is of all bundles, `conversion` is against
 * the previous step, so the screen can show both without the client doing arithmetic.
 */
export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  share: number;
  conversion: number | null;
};

export type AnalyticsSummary = {
  window: AnalyticsWindowDto;
  totals: MetricSlice;
  /** Same length, ending the day before this window starts. */
  previous: MetricSlice;
  profitChange: number;
  roiChange: number;
  /** Mean of per-bundle ROI, unlike team ROI which is weighted by spend. */
  avgBundleRoi: number;
  profitableShare: number;
  counts: { active: number; archived: number; inWindow: number };
  funnel: FunnelStage[];
};

export type TopBundleRow = MetricSlice & {
  id: string;
  name: string;
  status: BundleStatus;
  offer: Option;
  buyer: Option;
};

/**
 * Dictionary rows. `bundleCount` is what lets the UI explain why an offer cannot be
 * deleted while a tag can (its links to bundles are simply dropped).
 */
export type OfferRecord = {
  id: string;
  name: string;
  url: string | null;
  payoutUSD: number;
  network: string | null;
  isActive: boolean;
  bundleCount: number;
  createdAt: string;
};

export type GeoRecord = {
  id: string;
  code: string;
  name: string;
  bundleCount: number;
};

export type TagRecord = {
  id: string;
  name: string;
  color: string;
  bundleCount: number;
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  bundleCount: number;
  createdAt: string;
  /** Marks the caller's own row so the UI cannot offer self-deactivation. */
  isSelf: boolean;
};

/** Every write to a dictionary answers the same shape: what went away and what it took with it. */
export type RemovedRecord = {
  id: string;
  label: string;
  /** GEO and TAG rows are dropped from this many bundles by the join table's cascade. */
  unlinked?: number;
};

export type AppSettings = {
  roiAlertThreshold: number;
};

/**
 * Stage 7 — CSV import, the notification bell and the audit log. Import shapes describe
 * what a spreadsheet did or did not satisfy, so they are per row by construction; the
 * audit shapes are the system-wide version of the bundle feed already rendered per bundle.
 */

export type ImportRowOutcome = {
  /** Line number in the file, header included — the number a spreadsheet shows. */
  line: number;
  name: string | null;
  ok: boolean;
  /** Field key → message, the same envelope the form errors use. */
  errors: Record<string, string>;
};

export type ImportResult = {
  dryRun: boolean;
  /** Data rows the parser found. */
  rows: number;
  created: number;
  skipped: number;
  /** Rows that failed validation, whatever happened to the file. */
  invalid: number;
  /** True when the file carried errors and "skip invalid rows" was off, so nothing was written. */
  aborted: boolean;
  columns: { matched: string[]; ignored: string[]; missing: string[] };
  outcomes: ImportRowOutcome[];
};

export type NotificationDto = {
  id: string;
  /** Machine key (`roi_alert`); the UI picks an icon per type and falls back for unknown ones. */
  type: string;
  message: string;
  at: string;
  read: boolean;
  bundle: Option | null;
};

export type NotificationsResponse = {
  items: NotificationDto[];
  /** Count of everything unread for this account, not only what `items` carries. */
  unread: number;
};

export type AuditEntry = {
  id: string;
  kind: "change" | "comment";
  at: string;
  actor: Option;
  bundle: { id: string; label: string };
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  text: string | null;
};

export type AuditResponse = {
  items: AuditEntry[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  /** The log is merged from two tables over a scan window; set when that window was full. */
  truncated: boolean;
};

export type AuditFacets = {
  actors: Option[];
  fields: string[];
};

/**
 * Dictionary names a CSV may reference, shown next to the import preview so an unknown
 * offer is fixable without leaving the dialog.
 */
export type ImportVocabulary = {
  offers: string[];
  geos: string[];
  tags: string[];
};
