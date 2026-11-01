import { connection } from "next/server";
import { updateBundle } from "@/lib/bundles";
import { requireApiUser } from "@/lib/dal";
import { ApiError, readJson, toResponse } from "@/lib/http";
import { fieldErrors, bundleIdSchema, bundleUpdateSchema } from "@/lib/validations";

/**
 * Partial update of a bundle. Every changed field is written to BundleChange by
 * `updateBundle`, which is what the timeline on the detail page reads.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();

  return toResponse(async () => {
    const user = await requireApiUser();
    const { id } = bundleIdSchema.parse(await context.params);
    const parsed = bundleUpdateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));

    return updateBundle(user, id, parsed.data);
  });
}
