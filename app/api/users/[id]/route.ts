import { connection } from "next/server";
import { deleteUser, updateUser } from "@/lib/references";
import { requireApiAdmin } from "@/lib/dal";
import { ApiError, readJson, toResponse } from "@/lib/http";
import { fieldErrors, idParamSchema, userUpdateSchema } from "@/lib/validations";

/**
 * Role, name, email and the active flag. `lib/references.ts` refuses the two writes
 * that would lock the team out: removing your own access and demoting the last admin.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();

  return toResponse(async () => {
    const current = await requireApiAdmin();
    const { id } = idParamSchema.parse(await context.params);
    const parsed = userUpdateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));

    return updateUser(current, id, parsed.data);
  });
}

/** Only possible once the account owns no bundles — see `deleteUser`. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();

  return toResponse(async () => {
    const current = await requireApiAdmin();
    const { id } = idParamSchema.parse(await context.params);
    return deleteUser(current, id);
  });
}
