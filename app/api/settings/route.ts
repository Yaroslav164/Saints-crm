import { connection } from "next/server";
import { readSettings, writeSettings } from "@/lib/references";
import { recomputeRoiAlerts } from "@/lib/notifications";
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

/**
 * Moving the threshold re-raises every alert from the new line: the number in Settings and
 * the contents of the bell have to agree the moment the rule changes, and an admin who just
 * loosened it is the one person who would notice a stale list.
 *
 * The recomputation lives here rather than inside `writeSettings` because that would make
 * `lib/references.ts` import `lib/notifications.ts`, which already imports `readSettings`
 * from it — the routes are where the two are allowed to meet.
 */
export async function PUT(request: Request) {
  await connection();

  return toResponse(async () => {
    await requireApiAdmin();
    const parsed = settingsSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));

    const settings = await writeSettings(parsed.data);
    const { alerts } = await recomputeRoiAlerts();

    return { ...settings, alerts };
  });
}
