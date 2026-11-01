import type { BundleStatus } from "@/lib/generated/prisma/enums";

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
