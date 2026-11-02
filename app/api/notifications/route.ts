import { connection } from "next/server";
import { listNotifications } from "@/lib/notifications";
import { requireApiUser } from "@/lib/dal";
import { ApiError, toResponse } from "@/lib/http";
import { booleanParam, fieldErrors } from "@/lib/validations";
import { z } from "zod";

const querySchema = z.object({ unread: booleanParam });

/**
 * The caller's own alerts, newest first, with the unread count for the badge.
 *
 * Deliberately not cached: an alert is the thing the bell has to show the moment a bundle
 * crosses the line, and a minute of `cacheLife` here would hide a loss from the person the
 * alert was written for. Polling from the client is what keeps it fresh instead.
 */
export async function GET(request: Request) {
  await connection();

  return toResponse(async () => {
    const user = await requireApiUser();
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new ApiError(422, "Invalid filters", fieldErrors(parsed.error));

    return listNotifications(user, parsed.data.unread === true);
  });
}
