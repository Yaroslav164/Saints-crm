import { connection } from "next/server";
import { listAllBundles } from "@/lib/bundles";
import { requireApiUser } from "@/lib/dal";
import { ApiError, buildCsv, csvResponse, errorResponse } from "@/lib/http";
import { fieldErrors, bundleQuerySchema } from "@/lib/validations";
import { STATUS_META } from "@/lib/status";

const HEADERS = [
  "Name",
  "Offer",
  "Angle",
  "GEOs",
  "Buyer",
  "Status",
  "Budget planned",
  "Spent",
  "Revenue",
  "Clicks",
  "Conversions",
  "CR %",
  "ROI %",
  "Profit",
  "Created",
  "Updated",
];

/**
 * Same filters as the list endpoint, but every matching row instead of one page.
 * Errors use the shared JSON envelope; the success body is CSV, which is why this
 * route cannot go through `toResponse`.
 */
export async function GET(request: Request) {
  await connection();

  try {
    const user = await requireApiUser();
    const parsed = bundleQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new ApiError(422, "Invalid filters", fieldErrors(parsed.error));

    const items = await listAllBundles(parsed.data, user.id);
    const csv = buildCsv(
      HEADERS,
      items.map((item) => [
        item.name,
        item.offer.label,
        item.angle,
        item.geos.map((geo) => geo.label).join(" "),
        item.buyer.label,
        STATUS_META[item.status].label,
        item.budgetPlanned,
        item.budgetSpent,
        item.revenue,
        item.clicks,
        item.conversions,
        item.cr,
        item.roi,
        item.profit,
        item.createdAt.slice(0, 10),
        item.updatedAt.slice(0, 10),
      ]),
    );

    return csvResponse(`bundles-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return errorResponse(error);
  }
}
