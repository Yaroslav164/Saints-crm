import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { BundleStatus } from "@/lib/generated/prisma/enums";

export function BundleStatusBadge({ status, className }: { status: BundleStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant="outline" className={cn(meta.badgeClass, className)}>
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </Badge>
  );
}
