import { connection } from "next/server";
import { deleteOffer, updateOffer } from "@/lib/references";
import { requireApiAdmin } from "@/lib/dal";
import { ApiError, readJson, toResponse } from "@/lib/http";
import { fieldErrors, idParamSchema, offerUpdateSchema } from "@/lib/validations";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();

  return toResponse(async () => {
    await requireApiAdmin();
    const { id } = idParamSchema.parse(await context.params);
    const parsed = offerUpdateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));

    return updateOffer(id, parsed.data);
  });
}

/** Refused with 409 while bundles still point at the offer; deactivation is the way to retire it. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();

  return toResponse(async () => {
    await requireApiAdmin();
    const { id } = idParamSchema.parse(await context.params);
    return deleteOffer(id);
  });
}
