"use client";

import { useRef, useState } from "react";
import { Loader2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import toast from "react-hot-toast";
import { useImportBundles, useImportPreview } from "@/hooks/useImportBundles";
import { IMPORT_MAX_BYTES, IMPORT_MAX_LABEL } from "@/lib/validations";
import { cn } from "@/lib/utils";
import type { ImportResult, ImportVocabulary } from "@/types";

/** How many failing rows the dialog lists before pointing at the file instead. */
const SHOWN_ERRORS = 25;

/**
 * Import modal. A chosen file is validated on the server immediately, as a dry run, and
 * only written when the button is pressed — the preview *is* the import call with
 * `dryRun: true`. One endpoint with a flag rather than two, so what the dialog shows can
 * never disagree with what the import does.
 *
 * Nothing is parsed in the browser: the rules that decide whether a row is valid (which
 * offers exist, who may be assigned, whether conversions exceed clicks) all live on the
 * server, and a second implementation here would be a second source of truth about a file
 * the user is holding.
 */
export function ImportDialog({
  open,
  onOpenChange,
  vocabulary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vocabulary: ImportVocabulary;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [dragging, setDragging] = useState(false);

  const read = useImportPreview();
  const commit = useImportBundles(() => {
    setFile(null);
    setPreview(null);
    onOpenChange(false);
  });

  const reset = () => {
    setFile(null);
    setPreview(null);
    setDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const pick = async (next: File | null | undefined) => {
    if (!next) return;
    if (next.size > IMPORT_MAX_BYTES) {
      toast.error(`At most ${IMPORT_MAX_LABEL} per file`);
      return;
    }

    const text = await next.text();
    setFile({ name: next.name, text });
    setPreview(null);

    // The mutation's onError already raised a toast; catching keeps the rejection from
    // surfacing as an unhandled promise, since the caller cannot await this.
    try {
      setPreview(await read.mutateAsync({ text, skipInvalid }));
    } catch {
      /* nothing to add: the preview simply stays empty and the file can be re-picked */
    }
  };

  const ready = preview ? preview.rows - preview.invalid : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import bundles from CSV</DialogTitle>
          <DialogDescription>
            Columns are matched by name, so a file exported from this app can be edited and read back. Derived
            columns (CR, ROI, Profit) are ignored — they are calculated, not entered.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            id="bundle-import-file"
            onChange={(event) => void pick(event.target.files?.[0])}
          />

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void pick(event.dataTransfer.files?.[0]);
            }}
            className={cn(
              "rounded-xl border border-dashed p-6 text-center transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border bg-card/60",
            )}
          >
            <UploadIcon className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm">
              {file ? file.name : "Drop a CSV here, or"}
              <Label
                htmlFor="bundle-import-file"
                className={cn("cursor-pointer text-sm font-normal", file ? "ml-2 text-primary" : "text-primary")}
              >
                {file ? "choose another" : "choose a file"}
              </Label>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Required: Name, Offer, GEOs, Status. Up to {IMPORT_MAX_LABEL}.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Need the column list?{" "}
            <a
              href="/api/bundles/import/template"
              download
              className="text-primary underline-offset-4 hover:underline"
            >
              Download the template
            </a>
            . Offers, GEOs and tags must already exist in the dictionaries —{" "}
            {vocabulary.offers.length} offers, {vocabulary.geos.length} GEOs and {vocabulary.tags.length} tags are
            available.
          </p>

          {file && read.isPending && (
            <div className="space-y-2">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          )}

          {file && preview && !read.isPending && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Summary label="Rows" value={preview.rows} />
                <Summary label="Ready" value={preview.rows - preview.invalid} tone="ok" />
                <Summary label="With errors" value={preview.invalid} tone={preview.invalid > 0 ? "bad" : "neutral"} />
              </div>

              {preview.columns.ignored.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Ignored columns: {preview.columns.ignored.join(", ")}.
                </p>
              )}

              {preview.invalid === 0 ? (
                <p className="rounded-xl bg-success/10 p-3 text-sm text-success ring-1 ring-success/20">
                  Every row is valid. Importing creates {preview.rows - preview.invalid} bundle
                  {preview.rows - preview.invalid === 1 ? "" : "s"}.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {preview.invalid === 1 ? "1 row needs attention" : `${preview.invalid} rows need attention`}
                  </p>
                  <ul className="space-y-2">
                    {preview.outcomes
                      .filter((outcome) => !outcome.ok)
                      .slice(0, SHOWN_ERRORS)
                      .map((outcome) => (
                        <li key={outcome.line} className="rounded-xl bg-card p-3 text-xs ring-1 ring-foreground/10">
                          <p className="font-medium text-foreground">
                            Line {outcome.line}
                            {outcome.name ? ` — ${outcome.name}` : " — no name"}
                          </p>
                          <ul className="mt-1 space-y-0.5 text-muted-foreground">
                            {Object.entries(outcome.errors).map(([field, message]) => (
                              <li key={field}>
                                <span className="text-foreground">{field}</span>: {message}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                  </ul>
                  {preview.invalid > SHOWN_ERRORS && (
                    <p className="text-xs text-muted-foreground">
                      …and {preview.invalid - SHOWN_ERRORS} more — fix the file and pick it again.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-start gap-2">
                <Checkbox
                  id="skip-invalid"
                  checked={skipInvalid}
                  onCheckedChange={(value) => setSkipInvalid(value === true)}
                  disabled={preview.invalid === 0}
                />
                <Label htmlFor="skip-invalid" className="text-xs font-normal text-muted-foreground">
                  Import the valid rows and skip the rest. Turn this off to refuse the whole file if any row fails.
                </Label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={commit.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!file) return;
              commit.mutate({ text: file.text, dryRun: false, skipInvalid });
            }}
            disabled={!file || !preview || ready === 0 || read.isPending || commit.isPending}
          >
            {commit.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {ready > 0 ? `Import ${ready} row${ready === 1 ? "" : "s"}` : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Summary({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "ok" | "bad" }) {
  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "ok" && "text-success",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
