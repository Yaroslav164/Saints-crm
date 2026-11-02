import { connection } from "next/server";
import { createOffer, listOffers } from "@/lib/references";
import { requireApiAdmin, requireApiUser } from "@/lib/dal";
import { ApiError, readJson, toResponse } from "@/lib/http";
import { fieldErrors, offerSchema } from "@/lib/validations";

/**
 * Offers dictionary. Reading it is open to every signed-in member — the bundle form
 * cannot be drawn without it — while writing is an admin action, because a dictionary
 * row is shared by the whole team.
 */
export async function GET() {
  await connection();

  return toResponse(async () => {
    await requireApiUser();
    return listOffers();
  });
}

export async function POST(request: Request) {
  await connection();

  return toResponse(async () => {
    await requireApiAdmin();
    const parsed = offerSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));

    return createOffer(parsed.data);
  });
}
