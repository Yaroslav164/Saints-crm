import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";

function SidebarSkeleton() {
  return (
    <div className="hidden w-60 shrink-0 flex-col gap-2 border-r border-sidebar-border bg-sidebar p-3 md:flex">
      <div className="flex h-11 items-center px-1">
        <Skeleton className="h-8 w-36" />
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-full rounded-lg" />
      ))}
      <Skeleton className="mt-auto h-14 w-full rounded-lg" />
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex h-14 items-center gap-2 border-b border-border px-3 md:px-5">
      <Skeleton className="size-8 rounded-lg" />
      <Skeleton className="ml-auto h-8 w-28 rounded-lg" />
    </div>
  );
}

/**
 * App shell. Sidebar and Header read the session, so under Cache Components
 * each one needs its own boundary — the static shell (with the page content
 * below) still prerenders while they stream in.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>

      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<HeaderSkeleton />}>
          <Header />
        </Suspense>
        {/* pb keeps the mobile bottom nav from covering the last row */}
        <main className="flex-1 px-3 pb-20 pt-4 md:px-5 md:pb-6 md:pt-5">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}
