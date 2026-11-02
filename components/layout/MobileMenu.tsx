"use client";

import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandMark } from "./BrandMark";
import { NavList } from "./NavList";

/**
 * Drawer that replaces the sidebar on tablet widths. The hrefs come from the server-side
 * header because the role does — a client component here cannot read the session without
 * making the whole shell wait for it.
 */
export function MobileMenu({ hrefs }: { hrefs: string[] }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 gap-0 border-sidebar-border bg-sidebar p-0">
        <SheetHeader className="border-b border-sidebar-border px-4 py-3">
          <SheetTitle asChild>
            <div className="text-left font-normal">
              <BrandMark />
            </div>
          </SheetTitle>
        </SheetHeader>
        <div className="p-3">
          <NavList hrefs={hrefs} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
