import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BundleStatusBadge } from "@/components/bundles/BundleStatusBadge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { TopBundle } from "@/lib/dashboard";

/** Top-5 bundles by ROI over the last seven days of spend. */
export function TopBundlesWidget({ bundles, className }: { bundles: TopBundle[]; className?: string }) {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-sm">Top 5 by ROI — last 7 days</CardTitle>
        <CardDescription className="text-xs">
          Ranked on spend from the daily metrics, not on lifetime totals.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {bundles.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No spend recorded in the last week.</p>
        ) : (
          <ul className="divide-y divide-border">
            {bundles.map((bundle, index) => (
              <li key={bundle.id} className="flex items-center gap-3 py-2.5">
                <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{bundle.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {bundle.offer} · {bundle.buyer}
                  </p>
                </div>
                <BundleStatusBadge status={bundle.status} className="hidden sm:inline-flex" />
                <div className="w-20 shrink-0 text-right">
                  <p
                    className={cn(
                      "text-sm tabular-nums",
                      bundle.roi > 0 ? "text-success" : bundle.roi < 0 ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {formatPercent(bundle.roi)}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">{formatCurrency(bundle.profit)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
