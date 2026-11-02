import { connection } from "next/server";
import { createGeo, listGeos } from "@/lib/references";
import { requireApiAdmin, requireApiUser } from "@/lib/dal";
import { ApiError, readJson, toResponse } from "@/lib/http";
import { fieldErrors, geoSchema } from "@/lib/validations";

/** GEO dictionary — read by everyone, written by admins (see /api/offers for the same split). */
export async function GET() {
  await connection();

  return toResponse(async () => {
    await requireApiUser();
    return listGeos();
  });
}

export async function POST(request: Request) {
  await connection();

  return toResponse(async () => {
    await requireApiAdmin();
    const parsed = geoSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));

    return createGeo(parsed.data);
  });
}
