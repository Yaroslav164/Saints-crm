import { connection } from "next/server";
import { createTag, listTags } from "@/lib/references";
import { requireApiAdmin, requireApiUser } from "@/lib/dal";
import { ApiError, readJson, toResponse } from "@/lib/http";
import { fieldErrors, tagSchema } from "@/lib/validations";

/** Tag dictionary — read by everyone, written by admins. */
export async function GET() {
  await connection();

  return toResponse(async () => {
    await requireApiUser();
    return listTags();
  });
}

export async function POST(request: Request) {
  await connection();

  return toResponse(async () => {
    await requireApiAdmin();
    const parsed = tagSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));

    return createTag(parsed.data);
  });
}
