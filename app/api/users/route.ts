import { connection } from "next/server";
import { listUsers } from "@/lib/references";
import { requireApiAdmin } from "@/lib/dal";
import { toResponse } from "@/lib/http";

/**
 * Buyer accounts. Admin-only read: this list carries emails and roles, which the
 * bundle form does not need — it takes id and name from `facets.buyers` instead.
 * Accounts are created by public registration, so there is no POST here on purpose.
 */
export async function GET() {
  await connection();

  return toResponse(async () => {
    const user = await requireApiAdmin();
    return listUsers(user);
  });
}
