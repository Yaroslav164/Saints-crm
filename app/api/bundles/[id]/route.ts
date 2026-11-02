import { connection } from "next/server";
import { deleteBundle, getBundleDetail, updateBundle } from "@/lib/bundles";
import { requireApiUser } from "@/lib/dal";
import { ApiError, readJson, toResponse } from "@/lib/http";
import { fieldErrors, bundleIdSchema, bundleUpdateSchema } from "@/lib/validations";

/**
 * One bundle with its full history, comments and daily metrics — the payload the
 * detail page renders. Readable by any signed-in team member, because the list is
 * team-wide too; what a viewer may *do* travels as `permissions`.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();

  return toResponse(async () => {
    const user = await requireApiUser();
    const { id } = bundleIdSchema.parse(await context.params);
    return getBundleDetail(user, id);
  });
}

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

/** Hard delete, admin only. Archiving — the non-destructive option — is `POST /api/bundles/bulk`. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();

  return toResponse(async () => {
    const user = await requireApiUser();
    const { id } = bundleIdSchema.parse(await context.params);
    return deleteBundle(user, id);
  });
}
