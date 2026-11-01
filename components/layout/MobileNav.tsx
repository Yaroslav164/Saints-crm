"use client";

import { NavList } from "./NavList";

/** Bottom navigation for phones (spec: card view + bottom nav on mobile). */
export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-sidebar-border bg-sidebar/95 backdrop-blur md:hidden">
      <NavList variant="grid" />
    </nav>
  );
}
