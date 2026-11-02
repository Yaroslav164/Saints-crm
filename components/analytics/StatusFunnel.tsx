import { formatPercent } from "@/lib/utils";
import type { FunnelStage } from "@/types";

/**
 * How far the team's ideas get: everything in play → reached a test → earned more than
 * it spent → is being scaled. Not a chart library, because a funnel is four numbers and
 * the percentages the reader actually needs are the gaps between them.
 *
 * The stages are the current status of active bundles, so the caption says it: a bundle
 * drained last month is not "in play" today, and this is not a windowed count.
 */
export function StatusFunnel({ stages }: { stages: FunnelStage[] }) {
  const widest = Math.max(1, stages[0]?.count ?? 0);

  return (
    <ul className="space-y-3">
      {stages.map((stage) => (
        <li key={stage.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{stage.label}</span>
            <span className="tabular-nums font-medium">{stage.count}</span>
          </div>
          <div className="h-2 rounded-full bg-muted" role="presentation">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${Math.max(stage.count > 0 ? 4 : 0, (stage.count / widest) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {stage.conversion === null
              ? `${stage.share}% of active bundles`
              : `${stage.conversion}% of the step above · ${stage.share}% of active bundles`}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function funnelHeadline(stages: FunnelStage[]): string {
  const tested = stages.find((stage) => stage.key === "tested");
  const profitable = stages.find((stage) => stage.key === "profitable");
  if (!tested || !profitable || tested.count === 0) return "No tests recorded yet";
  return `${formatPercent(profitable.conversion ?? 0)} of tested bundles reached profit`;
}
