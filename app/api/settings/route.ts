import { connection } from "next/server";
import { readSettings, writeSettings } from "@/lib/references";
import { requireApiAdmin, requireApiUser } from "@/lib/dal";
import { ApiError, readJson, toResponse } from "@/lib/http";
import { fieldErrors, settingsSchema } from "@/lib/validations";

/**
 * Team-wide settings. Anyone may read the ROI alert threshold — it explains why a
 * bundle is flagged — while only an admin moves it.
 */
export async function GET() {
  await connection();

  return toResponse(async () => {
    await requireApiUser();
    return readSettings();
  });
}

export async function PUT(request: Request) {
  await connection();

  return toResponse(async () => {
    await requireApiAdmin();
    const parsed = settingsSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));

    return writeSettings(parsed.data);
  });
}
