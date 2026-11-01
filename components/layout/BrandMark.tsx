import { ShieldIcon } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <ShieldIcon className="size-4" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight">AFF SAINTS</span>
          <span className="block text-[0.7rem] leading-tight text-muted-foreground">Bundle CRM</span>
        </span>
      )}
    </div>
  );
}
