import { connection } from "next/server";
import { getTopBundles } from "@/lib/analytics";
import { requireApiUser } from "@/lib/dal";
import { ApiError, toResponse } from "@/lib/http";
import { fieldErrors, topBundlesQuerySchema } from "@/lib/validations";

/**
 * Bundles ranked by ROI over the period. `order=asc` gives the mirror question —
 * what to drain — from the same scan, and `userId`/`offerId`/`status` narrow it the
 * way the list screen does.
 */
export async function GET(request: Request) {
  await connection();

  return toResponse(async () => {
    await requireApiUser();
    const parsed = topBundlesQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new ApiError(422, "Invalid period or filter", fieldErrors(parsed.error));

    return getTopBundles(parsed.data);
  });
}
