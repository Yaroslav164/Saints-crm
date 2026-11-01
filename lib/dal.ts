import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import type { Role } from "@/lib/generated/prisma/enums";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

/**
 * Data access layer entry point. `cache` dedupes the session read across every
 * component of one request; it is still a request-time read, so callers that
 * render it must sit behind a Suspense boundary (a `loading.tsx` is enough).
 *
 * `connection()` is load-bearing, not decoration: when the cookie is missing or
 * fails to decode, Auth.js builds its own signin redirect with
 * `crypto.getRandomValues()`. Inside a Partial Prerender segment Next rejects
 * that as an unstable value (docs message `blocking-prerender-crypto`) and the
 * dynamic part errors instead of redirecting. Marking the scope request-time
 * first removes that restriction.
 */
export const getSessionUser = cache(async (): Promise<CurrentUser | null> => {
  await connection();
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
  };
});

/** For pages: sends anonymous visitors to the sign-in screen. */
export async function requirePageUser(): Promise<CurrentUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** For route handlers: a 401 the client can react to instead of a redirect. */
export async function requireApiUser(): Promise<CurrentUser> {
  const user = await getSessionUser();
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
