import { z } from "zod";
import { BundleStatus } from "@/lib/generated/prisma/enums";

export const bundleStatusValues = Object.values(BundleStatus) as [
  (typeof BundleStatus)[keyof typeof BundleStatus],
  ...(typeof BundleStatus)[keyof typeof BundleStatus][],
];

export const bundleStatusSchema = z.enum(bundleStatusValues);
export type BundleStatusForm = z.infer<typeof bundleStatusSchema>;

const id = z.string().min(1, "Required");
const password = z
  .string()
  .min(8, "At least 8 characters")
  // bcrypt reads 72 bytes; anything longer is silently truncated.
  .max(72, "At most 72 characters");

export const credentialsSchema = z.object({
  email: z.email("Enter a valid email"),
  password,
});
export type CredentialsForm = z.infer<typeof credentialsSchema>;

export const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2, "At least 2 characters").max(80, "At most 80 characters"),
});
export type RegisterForm = z.infer<typeof registerSchema>;

const money = z.coerce.number().min(0, "Cannot be negative").max(100_000_000, "Too large");
const counter = z.coerce.number().int("Whole numbers only").min(0).max(10_000_000_000);

const bundleFields = z.object({
  name: z.string().trim().min(3, "At least 3 characters").max(120, "At most 120 characters"),
  offerId: id,
  angle: z.string().trim().min(3, "Describe the approach").max(300, "At most 300 characters"),
  creative: z.union([z.url("Enter a valid URL"), z.literal("")]).optional(),
  geoIds: z.array(id).min(1, "Pick at least one GEO"),
  userId: id.optional(),
  status: bundleStatusSchema.default("IDEA"),
  budgetPlanned: money.default(0),
  budgetSpent: money.default(0),
  revenue: money.default(0),
  clicks: counter.default(0),
  conversions: counter.default(0),
  notes: z.string().trim().max(5000, "At most 5000 characters").optional(),
  tagIds: z.array(id).default([]),
});

export const bundleSchema = bundleFields.refine((value) => value.conversions <= value.clicks, {
  message: "Conversions cannot exceed clicks",
  path: ["conversions"],
});
export type BundleForm = z.infer<typeof bundleSchema>;

/** PUT payload: every field is optional, at least one must be present. */
export const bundleUpdateSchema = bundleFields
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });
export type BundleUpdateForm = z.infer<typeof bundleUpdateSchema>;

export const statusPatchSchema = z.object({ status: bundleStatusSchema });

export const commentSchema = z.object({
  text: z.string().trim().min(1, "Comment cannot be empty").max(2000, "At most 2000 characters"),
});

export const bundleIdSchema = z.object({ id: id });

export const offerSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(120, "At most 120 characters"),
  url: z.union([z.url("Enter a valid URL"), z.literal("")]).optional(),
  payoutUSD: money.default(0),
  network: z.string().trim().max(80, "At most 80 characters").optional(),
  isActive: z.boolean().optional(),
});
export type OfferForm = z.infer<typeof offerSchema>;

export const geoSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "2–3 letters")
    .max(3, "2–3 letters")
    .regex(/^[A-Z]{2,3}$/, "Use letters only, e.g. US"),
  name: z.string().trim().min(2, "At least 2 characters").max(60, "At most 60 characters"),
});
export type GeoForm = z.infer<typeof geoSchema>;

export const tagSchema = z.object({
  name: z.string().trim().min(1, "Required").max(40, "At most 40 characters"),
  color: z
    .string()
    .trim()
    .regex(/^#([\da-f]{3}|[\da-f]{6})$/i, "Use a hex colour, e.g. #6366f1"),
});
export type TagForm = z.infer<typeof tagSchema>;

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.email("Enter a valid email").optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  isActive: z.boolean().optional(),
});

export const settingsSchema = z.object({
  roiAlertThreshold: z.coerce.number().min(-100).max(1000),
});

/**
 * List query for /api/bundles. Filters arrive as URL search params, so numbers
 * are coerced and multi-values accept a comma-separated list.
 */
const csvStrings = z
  .string()
  .transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean));

const csvEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  csvStrings.pipe(z.array(z.enum(values)));

const booleanParam = z
  .string()
  .transform((value) => value === "true" || value === "1")
  .optional();

/** Whitelist: anything outside it must never reach Prisma's orderBy. */
export const bundleSortValues = [
  "name",
  "status",
  "offer",
  "buyer",
  "budgetPlanned",
  "budgetSpent",
  "revenue",
  "clicks",
  "conversions",
  "cr",
  "roi",
  "profit",
  "createdAt",
  "updatedAt",
] as const;

export const bundleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: csvEnum(bundleStatusValues).optional(),
  offerId: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
  /** `mine=1` keeps "my active tests" shareable without embedding an internal id. */
  mine: booleanParam,
  geoId: z.string().trim().min(1).optional(),
  tagId: z.string().trim().min(1).optional(),
  roiMin: z.coerce.number().optional(),
  roiMax: z.coerce.number().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sort: z.enum(bundleSortValues).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  archived: booleanParam,
});
export type BundleQuery = z.infer<typeof bundleQuerySchema>;

export const bulkBundleSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), ids: z.array(id).min(1).max(200), status: bundleStatusSchema }),
  z.object({ action: z.enum(["archive", "unarchive", "delete"]), ids: z.array(id).min(1).max(200) }),
]);
export type BulkBundleForm = z.infer<typeof bulkBundleSchema>;

/** Flattens a ZodError into `field → first message` for form UIs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    result[key] ??= issue.message;
  }
  return result;
}
