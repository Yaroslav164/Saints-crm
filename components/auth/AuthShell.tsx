import { ShieldIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Shared frame for the sign-in / sign-up screens. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ShieldIcon className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-wide text-foreground">AFF SAINTS</p>
            <p className="text-xs text-muted-foreground">Bundle tracking CRM</p>
          </div>
        </div>

        <Card className="gap-4 p-5 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </Card>

        {footer}
      </div>
    </main>
  );
}
