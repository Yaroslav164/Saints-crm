import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic redirect guard only: it answers anonymous navigations with a real
 * HTTP redirect before the page starts streaming, which Partial Prerender
 * otherwise cannot do because the static shell is already on its way.
 *
 * It deliberately does NOT validate the token — the JWT signature is verified in
 * lib/dal.ts (requirePageUser) and in every route handler, so a forged cookie
 * reaches the skeleton but never any data.
 */
const SESSION_COOKIES = ["authjs.session-token", "__Host-authjs.session-token"];

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => request.cookies.has(name));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Presence-only, so it can be used to BLOCK anonymous requests but never to
  // bounce a holder of an invalid cookie back into the app: an expired token
  // would then reach a page, get redirected to the sign-in screen again, and the
  // two rules would chase each other. The sign-in screen therefore stays
  // reachable while a stale cookie exists, and the post-login redirect to "/"
  // happens in the client form.
  if (!pathname.startsWith("/auth/") && !hasSessionCookie(request)) {
    const target = new URL("/auth/login", request.url);
    if (pathname !== "/") target.searchParams.set("from", pathname);
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  // Every page behind the login, so an anonymous visit gets a real 307 with the original
  // path instead of a streamed redirect. `/audit` belongs here for the same reason the
  // others do; `/api/*` deliberately does not — those answers are JSON, and a redirect
  // would turn a readable 401 into an empty 307 for every script that calls them.
  matcher: ["/", "/bundles/:path*", "/analytics/:path*", "/audit/:path*", "/settings/:path*", "/auth/:path*"],
};
