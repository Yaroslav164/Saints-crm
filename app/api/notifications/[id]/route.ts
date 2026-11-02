import { connection } from "next/server";
import { removeNotification } from "@/lib/notifications";
import { requireApiUser } from "@/lib/dal";
import { toResponse } from "@/lib/http";
import { idParamSchema } from "@/lib/validations";

/**
 * Dismissal of one alert. Scoped to the caller's own rows inside `removeNotification`, so
 * an id that belongs to somebody else is answered the same as one that does not exist —
 * the list is private and this must not become a way to probe it.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();

  return toResponse(async () => {
    const user = await requireApiUser();
    const { id } = idParamSchema.parse(await context.params);
    return removeNotification(user, id);
  });
}
