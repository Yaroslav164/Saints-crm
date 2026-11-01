import { ChartLine, Layers, LayoutDashboard, Settings, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only the index item should stop matching nested routes. */
  exact?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/bundles", label: "Bundles", icon: Layers },
  { href: "/analytics", label: "Analytics", icon: ChartLine },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
