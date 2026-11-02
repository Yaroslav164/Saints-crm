import { Skeleton } from "@/components/ui/skeleton";

/**
 * Stream boundary for the audit segment. The page below reads the log straight from the
 * database, so this is what the admin sees during that round trip — the same shape as the
 * table it replaces, so the page does not jump when the rows arrive.
 */
export default function AuditLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-12 w-44 rounded-lg" />
        ))}
      </div>

      <div className="space-y-2 rounded-xl p-1 ring-1 ring-foreground/10">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
