import { connection } from "next/server";
import { createBundle, listBundles } from "@/lib/bundles";
import { ApiError, readJson, toResponse } from "@/lib/http";
import { requireApiUser } from "@/lib/dal";
import { fieldErrors, bundleQuerySchema, bundleSchema } from "@/lib/validations";

export async function GET(request: Request) {
  await connection();

  return toResponse(async () => {
    const user = await requireApiUser();
    const parsed = bundleQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new ApiError(422, "Invalid filters", fieldErrors(parsed.error));

    return listBundles(parsed.data, user.id);
  });
}

export async function POST(request: Request) {
  await connection();

  return toResponse(async () => {
    const user = await requireApiUser();
    const parsed = bundleSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));

    return createBundle(user, parsed.data);
  });
}
