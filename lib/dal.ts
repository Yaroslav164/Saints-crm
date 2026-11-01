import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import type { Role } from "@/lib/generated/prisma/enums";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

/** Plain request-time session read — used by route handlers. */
async function readSessionUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
  };
}

/**
 * Page-facing session read. `'use cache: private'` keeps the result in the
 * visitor's browser only, never on the server, which is what lets Next prefetch
 * the authenticated shell: without it every client-side navigation blocks on this
 * read and the dev overlay reports "uncached data during a navigation".
 *
 * `redirect()` inside the scope throws to interrupt rendering rather than return,
 * so it is not cached. Route handlers deliberately use `readSessionUser` instead:
 * a private cache entry has no browser to live in there.
 */
export async function getSessionUser(): Promise<CurrentUser | null> {
  "use cache: private";
  return readSessionUser();
}

/** For pages: sends anonymous visitors to the sign-in screen. */
export async function requirePageUser(): Promise<CurrentUser> {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  return user;
}

/** For route handlers: a 401 the client can react to instead of a redirect. */
export async function requireApiUser(): Promise<CurrentUser> {
  const user = await readSessionUser();
  if (!user) throw new ApiError(401, "Sign in required");
  return user;
}

export async function requireApiAdmin(): Promise<CurrentUser> {
  const user = await requireApiUser();
  if (user.role !== "ADMIN") throw new ApiError(403, "Admin access required");
  return user;
}

export function isAdmin(user: CurrentUser): boolean {
  return user.role === "ADMIN";
}

/** Admins manage everything, buyers only their own bundles. */
export function canManageBundle(user: CurrentUser, bundle: { userId: string }): boolean {
  return isAdmin(user) || bundle.userId === user.id;
}

export function canEditBundle(user: CurrentUser, bundle: { userId: string }): boolean {
  return canManageBundle(user, bundle);
}
