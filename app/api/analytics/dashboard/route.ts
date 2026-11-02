import { connection } from "next/server";
import { getAnalyticsSummary } from "@/lib/analytics";
import { requireApiUser } from "@/lib/dal";
import { ApiError, toResponse } from "@/lib/http";
import { fieldErrors, analyticsWindowSchema } from "@/lib/validations";

/**
 * Team totals for the period plus the period before it and the status funnel.
 * `days` is a preset window; `from`/`to` override it with an explicit range.
 */
export async function GET(request: Request) {
  await connection();

  return toResponse(async () => {
    await requireApiUser();
    const parsed = analyticsWindowSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new ApiError(422, "Invalid period", fieldErrors(parsed.error));

    return getAnalyticsSummary(parsed.data);
  });
}
