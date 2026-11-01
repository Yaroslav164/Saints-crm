import { connection } from "next/server";
import { setBundleStatus } from "@/lib/bundles";
import { requireApiUser } from "@/lib/dal";
import { ApiError, readJson, toResponse } from "@/lib/http";
import { fieldErrors, bundleIdSchema, statusPatchSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await connection();

  return toResponse(async () => {
    const user = await requireApiUser();
    const { id } = bundleIdSchema.parse(await context.params);
    const parsed = statusPatchSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));

    return setBundleStatus(user, id, parsed.data.status);
  });
}
