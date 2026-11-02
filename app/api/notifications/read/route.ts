import { connection } from "next/server";
import { markNotificationsRead } from "@/lib/notifications";
import { requireApiUser } from "@/lib/dal";
import { ApiError, readJson, toResponse } from "@/lib/http";
import { fieldErrors, markReadSchema } from "@/lib/validations";

/**
 * Read receipt for the bell. A body with `ids` marks those rows; an empty body or no body
 * at all marks everything unread, which is what "Mark all as read" sends — the client does
 * not need to know which ids are unread to ask for that.
 */
export async function POST(request: Request) {
  await connection();

  return toResponse(async () => {
    const user = await requireApiUser();
    const contentType = request.headers.get("content-type") ?? "";
    const raw = contentType.includes("application/json") ? await readJson(request) : {};

    const parsed = markReadSchema.safeParse(raw);
    if (!parsed.success) throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));

    return markNotificationsRead(user, parsed.data.ids);
  });
}
