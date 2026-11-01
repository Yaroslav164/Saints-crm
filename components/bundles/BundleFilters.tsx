"use client";

import { RotateCcwIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_META, STATUS_ORDER } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { QueryState } from "@/hooks/useBundles";
import type { BundleFacets } from "@/types";

const ALL = "all";

function readForm(data: FormData): QueryState {
  const patch: QueryState = {};
  for (const key of ["search", "roiMin", "roiMax", "dateFrom", "dateTo"]) {
    const value = String(data.get(key) ?? "").trim();
    if (value) patch[key] = value;
  }
  return patch;
}

/**
 * Filter bar. Selects and status chips commit immediately; the free-text fields
 * commit on submit (Enter or Search) so a query is not fired per keystroke.
 * `formKey` remounts the form on reset, which is how the uncontrolled inputs are
 * cleared without mirroring them into state.
 */
export function BundleFilters({
  state,
  facets,
  formKey,
  onChange,
  onReset,
}: {
  state: QueryState;
  facets: BundleFacets;
  formKey: number;
  onChange: (next: QueryState) => void;
  onReset: () => void;
}) {
  const statuses = state.status ? state.status.split(",").filter(Boolean) : [];
  const active = Object.keys(state).length > 0;

  const toggleStatus = (value: string) => {
    const next = statuses.includes(value) ? statuses.filter((item) => item !== value) : [...statuses, value];
    onChange({ ...state, status: next.join(",") });
  };

  const setSingle = (key: string, value: string) =>
    onChange({ ...state, [key]: value === ALL ? "" : value });

  return (
    <form
      key={formKey}
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onChange({ ...state, ...readForm(new FormData(event.currentTarget)) });
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="search"
            defaultValue={state.search ?? ""}
            placeholder="Search by name"
            className="h-8 w-56 pl-8"
            aria-label="Search bundles by name"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by status">
          {STATUS_ORDER.map((value) => {
            const selected = statuses.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleStatus(value)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  selected
                    ? STATUS_META[value].badgeClass
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {STATUS_META[value].emoji} {STATUS_META[value].label}
              </button>
            );
          })}
        </div>

        <Button type="submit" size="sm" variant="outline">
          Search
        </Button>
        {active && (
          <Button type="button" size="sm" variant="ghost" onClick={onReset}>
            <RotateCcwIcon />
            Reset
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          id="offerId"
          label="Offer"
          value={state.offerId ?? ALL}
          options={[{ id: ALL, label: "All offers" }, ...facets.offers]}
          onChange={(value) => setSingle("offerId", value)}
        />
        <FilterSelect
          id="userId"
          label="Buyer"
          value={state.userId ?? ALL}
          options={[{ id: ALL, label: "All buyers" }, ...facets.buyers]}
          onChange={(value) => setSingle("userId", value)}
        />
        <FilterSelect
          id="geoId"
          label="GEO"
          value={state.geoId ?? ALL}
          options={[{ id: ALL, label: "All GEOs" }, ...facets.geos]}
          onChange={(value) => setSingle("geoId", value)}
        />
        <FilterSelect
          id="archived"
          label="State"
          value={state.archived ?? ALL}
          options={[
            { id: ALL, label: "Active + archived" },
            { id: "false", label: "Active only" },
            { id: "true", label: "Archived only" },
          ]}
          onChange={(value) => setSingle("archived", value)}
        />

        <div className="flex items-end gap-2">
          <Field id="roiMin" label="ROI min %">
            <Input id="roiMin" name="roiMin" type="number" step="1" defaultValue={state.roiMin ?? ""} className="h-8 w-20" />
          </Field>
          <Field id="roiMax" label="ROI max %">
            <Input id="roiMax" name="roiMax" type="number" step="1" defaultValue={state.roiMax ?? ""} className="h-8 w-20" />
          </Field>
        </div>

        <div className="flex items-end gap-2">
          <Field id="dateFrom" label="Created from">
            <Input id="dateFrom" name="dateFrom" type="date" defaultValue={state.dateFrom ?? ""} className="h-8 w-36" />
          </Field>
          <Field id="dateTo" label="Created to">
            <Input id="dateTo" name="dateTo" type="date" defaultValue={state.dateTo ?? ""} className="h-8 w-36" />
          </Field>
        </div>
      </div>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-8 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
