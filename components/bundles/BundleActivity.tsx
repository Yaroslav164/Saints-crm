import { ArrowRightIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { describeChange } from "@/lib/timeline";
import { cn, formatDateTime, initials } from "@/lib/utils";
import type { BundleActivityEntry } from "@/types";

/**
 * The activity feed: field changes and team comments in one chronological column,
 * oldest first, the way a GitHub issue thread reads. Rendering lives here rather than
 * in the DTO so `lib/timeline.ts` stays about words, not markup.
 */
export function BundleActivity({
  entries,
  currentUserId,
}: {
  entries: BundleActivityEntry[];
  currentUserId: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
        Nothing recorded yet. Comments and field changes appear here in order.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={`${entry.kind}-${entry.id}`} className="flex gap-3">
          <Avatar size="sm" className="mt-0.5 shrink-0">
            <AvatarFallback className="bg-primary/15 text-[10px] font-medium text-primary">
              {initials(entry.actor.label)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{entry.actor.label}</span>
              {entry.actor.id === currentUserId ? " (you)" : ""}
              {" · "}
              <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
            </p>

            {entry.kind === "comment" ? (
              <p className="rounded-xl bg-card p-3 text-sm break-words ring-1 ring-foreground/10 whitespace-pre-wrap">
                {entry.text}
              </p>
            ) : (
              <ChangeLine entry={entry} />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ChangeLine({ entry }: { entry: BundleActivityEntry }) {
  const change = describeChange(entry.field ?? "", entry.oldValue, entry.newValue);

  if (change.isCreation) {
    return <p className="text-sm text-muted-foreground">created this bundle</p>;
  }

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">
        {change.isStatus ? "changed status" : `updated ${change.label}`}
      </span>

      {change.from !== null && (
        <>
          <span
            title={change.from}
            className="max-w-64 truncate rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground line-through decoration-muted-foreground/40"
          >
            {change.from}
          </span>
          <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground" />
        </>
      )}

      <span
        title={change.to}
        className={cn(
          "max-w-64 truncate rounded-md px-1.5 py-0.5 text-xs",
          change.isStatus ? "border border-primary/30 bg-primary/10 text-primary" : "bg-muted",
        )}
      >
        {change.to}
      </span>
    </p>
  );
}
