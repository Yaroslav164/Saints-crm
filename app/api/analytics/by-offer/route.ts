import { connection } from "next/server";
import { getAnalyticsByOffer } from "@/lib/analytics";
import { requireApiUser } from "@/lib/dal";
import { ApiError, toResponse } from "@/lib/http";
import { fieldErrors, analyticsWindowSchema } from "@/lib/validations";

/** Revenue against spend per offer for the period, best profit first. */
export async function GET(request: Request) {
  await connection();

  return toResponse(async () => {
    await requireApiUser();
    const parsed = analyticsWindowSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new ApiError(422, "Invalid period", fieldErrors(parsed.error));

    return getAnalyticsByOffer(parsed.data);
  });
}
