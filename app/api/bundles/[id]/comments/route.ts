import { connection } from "next/server";
import { addBundleComment } from "@/lib/bundles";
import { requireApiUser } from "@/lib/dal";
import { ApiError, readJson, toResponse } from "@/lib/http";
import { fieldErrors, bundleIdSchema, commentSchema } from "@/lib/validations";

/**
 * Adds a comment to the team thread. Any signed-in member may comment on any
 * bundle — reviewing someone else's test is the point of the CRM — while the text
 * itself is validated by the same Zod schema the composer uses.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();

  return toResponse(async () => {
    const user = await requireApiUser();
    const { id } = bundleIdSchema.parse(await context.params);
    const parsed = commentSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));

    return addBundleComment(user, id, parsed.data.text);
  });
}
