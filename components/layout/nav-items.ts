import { ChartLine, History, Layers, LayoutDashboard, Settings, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/generated/prisma/enums";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only the index item should stop matching nested routes. */
  exact?: boolean;
  /** Hidden for every role but ADMIN — and the page guards the URL too, the link is not the gate. */
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/bundles", label: "Bundles", icon: Layers },
  { href: "/analytics", label: "Analytics", icon: ChartLine },
  { href: "/audit", label: "Audit log", icon: History, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * Icon components are not serialisable across the server/client boundary, so the shell
 * pieces pass hrefs rather than items: the role is read on the server, `NavList` looks the
 * rest up here. One function decides what a role may navigate to, and the bottom bar uses
 * it with the lowest role on purpose — a five-column bar for admins only would put the
 * same link in one place for one person and nowhere for another.
 */
export function navHrefsForRole(role: Role): string[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || role === "ADMIN").map((item) => item.href);
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
