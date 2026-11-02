"use client";

import { CalendarDaysIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { WindowState } from "@/hooks/useAnalytics";

const PRESETS = [
  { days: "7", label: "7 days" },
  { days: "14", label: "2 weeks" },
  { days: "30", label: "30 days" },
  { days: "90", label: "Quarter" },
];

/**
 * Period control. Presets and an explicit range write into the same URL state, and the
 * free-text dates commit on submit rather than per keystroke — the pattern the bundle
 * filter bar already uses, so an incomplete date never fires a query.
 */
export function PeriodPicker({
  state,
  defaultDays,
  onChange,
}: {
  state: WindowState;
  defaultDays: string;
  onChange: (next: WindowState) => void;
}) {
  const custom = Boolean(state.from || state.to);
  const days = state.days ?? defaultDays;

  const pickPreset = (value: string) => onChange({ ...state, days: value, from: "", to: "" });

  const applyRange = (data: FormData) => {
    const from = String(data.get("from") ?? "").trim();
    const to = String(data.get("to") ?? "").trim();
    if (!from && !to) return;
    onChange({ ...state, from, to });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Period">
        {PRESETS.map((preset) => {
          const selected = !custom && days === preset.days;
          return (
            <button
              key={preset.days}
              type="button"
              aria-pressed={selected}
              onClick={() => pickPreset(preset.days)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          applyRange(new FormData(event.currentTarget));
        }}
      >
        <RangeField id="analyticsFrom" label="From" value={state.from ?? ""} />
        <RangeField id="analyticsTo" label="To" value={state.to ?? ""} />
        <Button type="submit" size="sm" variant="outline">
          <CalendarDaysIcon />
          Apply
        </Button>
      </form>

      {custom && (
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...state, from: "", to: "" })}>
          <RotateCcwIcon />
          Back to preset
        </Button>
      )}
    </div>
  );
}

function RangeField({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={id} name={id === "analyticsFrom" ? "from" : "to"} type="date" defaultValue={value} className="h-8 w-36" />
    </div>
  );
}
