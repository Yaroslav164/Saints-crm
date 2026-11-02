import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shape-of-the-page skeleton for one bundle. The page below it awaits the session and
 * a per-row database read, so this is what the user sees during that round trip.
 */
export default function BundleDetailLoading() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-72 max-w-full" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-32 rounded-lg" />
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-xl" />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-56 rounded-xl" />
          <div className="space-y-3 rounded-xl p-4 ring-1 ring-foreground/10">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
