"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "./nav-items";
import { cn } from "@/lib/utils";

/**
 * Rendered in three shapes — sidebar, tablet drawer and mobile bottom bar — so
 * the active state and item list live in one place. NAV_ITEMS is imported here
 * rather than passed as a prop: icon components are not serialisable across the
 * server/client boundary.
 */
export function NavList({ variant = "stack" }: { variant?: "stack" | "grid" }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        variant === "stack" && "flex flex-col gap-1",
        variant === "grid" && "grid grid-cols-4",
      )}
      aria-label="Main"
    >
      {NAV_ITEMS.map((item) => {
        const active = isNavItemActive(item, pathname);
        const Icon = item.icon;

        return variant === "grid" ? (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2 text-[0.7rem] transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4.5" />
            {item.label}
          </Link>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-primary/15 font-medium text-primary"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
