"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAppSettings, useSaveSettings } from "@/hooks/useReferences";
import { fieldErrors, settingsSchema } from "@/lib/validations";
import { formatPercent } from "@/lib/utils";

/**
 * Alert threshold. One number, saved into the `settings` table, and it behaves like the
 * rest of the dictionaries: readable by anyone (a buyer has to know why their bundle is
 * flagged), writable by an admin.
 *
 * The field is a string while it is being typed and is parsed by the same Zod schema the
 * server uses, so "-abc" is caught before it reaches the API rather than as a 422 toast.
 */
export function AlertsTab({ canManage }: { canManage: boolean }) {
  // `null` means "nothing typed yet", so the input mirrors the server value and a save
  // that rewrites the number (rounding, a concurrent admin) becomes visible as soon as
  // the query refetches instead of being covered by a local copy.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  const settings = useAppSettings();
  const save = useSaveSettings(() => setDraft(null));

  const value = draft ?? (settings.data !== undefined ? String(settings.data.roiAlertThreshold) : "");

  const submit = () => {
    const parsed = settingsSchema.safeParse({ roiAlertThreshold: value });
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).roiAlertThreshold ?? "Invalid value");
      return;
    }
    setError(undefined);
    save.mutate({ roiAlertThreshold: parsed.data.roiAlertThreshold });
  };

  const threshold = settings.data?.roiAlertThreshold;
  const dirty = settings.data !== undefined && Number(value) !== settings.data.roiAlertThreshold;

  return (
    <Card className="shadow-sm">
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-sm">ROI alerts</CardTitle>
        <CardDescription className="text-xs">
          The line a bundle has to fall under before the team is told about it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        {settings.isPending ? (
          <p className="text-sm text-muted-foreground">Reading the settings…</p>
        ) : settings.isError ? (
          <p className="text-sm text-destructive">{settings.error.message}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <label htmlFor="roiAlertThreshold" className="text-xs text-muted-foreground">
                  Threshold, %
                </label>
                <Input
                  id="roiAlertThreshold"
                  type="number"
                  step="1"
                  min="-100"
                  max="1000"
                  className="w-32"
                  value={value}
                  disabled={!canManage}
                  onChange={(event) => setDraft(event.target.value)}
                  aria-invalid={Boolean(error)}
                />
                {error ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Currently {threshold !== undefined ? formatPercent(threshold) : "—"} · allowed −100…1000
                  </p>
                )}
              </div>
              {canManage && (
                <Button type="button" onClick={submit} disabled={save.isPending || !dirty}>
                  {save.isPending ? <Loader2Icon className="animate-spin" /> : null}
                  Save
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Existing alerts keep the message they were raised with; changing this line affects the alerts raised from
              now on.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
