"use client";

import { NavList } from "./NavList";
import { navHrefsForRole } from "./nav-items";

/**
 * Bottom navigation for phones (spec: card view + bottom nav on mobile).
 *
 * The bar is deliberately the same four items for every role: it has room for four, and
 * giving an admin a fifth column would move every other icon on the only screen where
 * space is scarcest. The audit log stays reachable from the drawer in the header.
 */
export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-sidebar-border bg-sidebar/95 backdrop-blur md:hidden">
      <NavList variant="grid" hrefs={navHrefsForRole("USER")} />
    </nav>
  );
}
