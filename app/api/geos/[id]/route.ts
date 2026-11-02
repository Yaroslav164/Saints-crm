import { connection } from "next/server";
import { deleteGeo, updateGeo } from "@/lib/references";
import { requireApiAdmin } from "@/lib/dal";
import { ApiError, readJson, toResponse } from "@/lib/http";
import { fieldErrors, geoUpdateSchema, idParamSchema } from "@/lib/validations";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();

  return toResponse(async () => {
    await requireApiAdmin();
    const { id } = idParamSchema.parse(await context.params);
    const parsed = geoUpdateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));

    return updateGeo(id, parsed.data);
  });
}

/** Deleting a GEO unlinks it from its bundles; the bundles themselves are kept. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();

  return toResponse(async () => {
    await requireApiAdmin();
    const { id } = idParamSchema.parse(await context.params);
    return deleteGeo(id);
  });
}
