import { connection } from "next/server";
import { applyBulkBundles } from "@/lib/bundles";
import { requireApiUser } from "@/lib/dal";
import { ApiError, readJson, toResponse } from "@/lib/http";
import { fieldErrors, bulkBundleSchema } from "@/lib/validations";

/**
 * Bulk status change / archive / delete from the list screen. The spec's route
 * table has no bulk endpoint, so this is the one addition: doing it client-side
 * would fire one request per row and lose the shared change log.
 */
export async function POST(request: Request) {
  await connection();

  return toResponse(async () => {
    const user = await requireApiUser();
    const parsed = bulkBundleSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));

    return applyBulkBundles(user, parsed.data);
  });
}
