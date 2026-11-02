import { connection } from "next/server";
import { listAudit } from "@/lib/audit";
import { requireApiAdmin } from "@/lib/dal";
import { ApiError, toResponse } from "@/lib/http";
import { auditQuerySchema, fieldErrors } from "@/lib/validations";

/**
 * The system-wide change log. Admin only: the same list a buyer can already read one
 * bundle at a time on its detail page, but in bulk it is the management view of the
 * team's work — who moved what, and when — and that is not something to hand to every
 * account.
 */
export async function GET(request: Request) {
  await connection();

  return toResponse(async () => {
    await requireApiAdmin();

    const parsed = auditQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new ApiError(422, "Invalid filters", fieldErrors(parsed.error));

    return listAudit(parsed.data);
  });
}
