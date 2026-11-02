"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { BellIcon, CheckCheckIcon, TrendingDownIcon, XIcon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useDismissNotification, useMarkNotificationsRead, useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import type { NotificationDto } from "@/types";

/**
 * Icon per alert type, with the same fallback rule the activity feed uses for an unknown
 * field key: a type written by a later stage must show up as a notification nobody
 * described, not vanish from the bell.
 */
const TYPE_ICON: Record<string, LucideIcon> = {
  roi_alert: TrendingDownIcon,
};

/** The badge caps the count because a number that wide would push the account menu off the bar. */
const BADGE_LIMIT = 9;

function ago(iso: string): string {
  return `${formatDistanceToNowStrict(new Date(iso), { roundingMethod: "floor" })} ago`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const notifications = useNotifications();
  const markRead = useMarkNotificationsRead();
  const dismiss = useDismissNotification();

  const unread = notifications.data?.unread ?? 0;
  const items = notifications.data?.items ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unread} unread)`}>
          <BellIcon />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[0.6rem] leading-4 font-medium text-primary-foreground">
              {unread > BADGE_LIMIT ? `${BADGE_LIMIT}+` : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markRead.mutate()}
              disabled={markRead.isPending}
            >
              <CheckCheckIcon />
              Mark all read
            </Button>
          )}
        </div>

        {notifications.isPending ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : notifications.isError ? (
          <p className="p-3 text-sm text-destructive">Could not load notifications.</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">
            Nothing to report. An alert appears here when a bundle&apos;s ROI falls under the threshold set in
            Settings → Alerts.
          </p>
        ) : (
          /*
           * A plain scroll container, not the vendored `ScrollArea`: its viewport is
           * `size-full`, which only resolves against a *definite* height, so a `max-h-*`
           * root lets the list grow past the popover instead of scrolling (measured: root
           * 320 px, viewport 518 px, nothing clipped). The list is content-sized here, and
           * `color-scheme` on <html> already themes the native scrollbar in both themes.
           */
          <div className="max-h-80 overflow-y-auto">
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onOpen={() => {
                    setOpen(false);
                    if (!item.read) markRead.mutate([item.id]);
                  }}
                  onDismiss={() => dismiss.mutate(item.id)}
                />
              ))}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NotificationRow({
  item,
  onOpen,
  onDismiss,
}: {
  item: NotificationDto;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const Icon = TYPE_ICON[item.type] ?? BellIcon;

  const body = (
    <div className="flex gap-2">
      <Icon className={cn("mt-0.5 size-4 shrink-0", item.read ? "text-muted-foreground" : "text-destructive")} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className={cn("text-xs break-words", item.read ? "text-muted-foreground" : "text-foreground")}>
          {item.message}
        </p>
        <p className="text-[0.65rem] text-muted-foreground">
          {ago(item.at)}
          {item.bundle ? ` · ${item.bundle.label}` : ""}
        </p>
      </div>
    </div>
  );

  return (
    <li className="flex items-start gap-1 px-3 py-2 transition-colors hover:bg-muted/60">
      {/* The whole row is the link when there is a bundle to open; a read receipt is sent on
          the way there, so coming back shows the alert as handled without another click.
          An alert with no bundle has nowhere to go, so it stays plain text — "Mark all read"
          covers it, and a button that does nothing is worse than no button. */}
      {item.bundle ? (
        <Link href={`/bundles/${item.bundle.id}`} className="min-w-0 flex-1" onClick={onOpen}>
          {body}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{body}</div>
      )}

      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="shrink-0"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        <XIcon />
      </Button>
    </li>
  );
}
