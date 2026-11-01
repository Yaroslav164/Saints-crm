import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "positive" | "negative";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "text-foreground",
  positive: "text-emerald-400",
  negative: "text-red-400",
};

export function StatsCard({
  title,
  value,
  hint,
  tone = "neutral",
  icon,
  className,
}: {
  title: string;
  value: string;
  hint?: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-xl border-slate-800 bg-slate-900 shadow-sm", className)}>
      <CardContent className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
          <p className={cn("text-2xl leading-tight font-semibold tabular-nums", TONE_CLASS[tone])}>{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && <div className="shrink-0 text-muted-foreground">{icon}</div>}
      </CardContent>
    </Card>
  );
}
