"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon, RotateCcwIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination, TableSkeleton } from "@/components/bundles/BundleTable";
import { useAuditQuery, type AuditState } from "@/hooks/useAudit";
import { toQuery } from "@/lib/api-client";
import { describeChange, fieldLabel } from "@/lib/timeline";
import { cn, formatDateTime } from "@/lib/utils";
import type { AuditEntry, AuditFacets } from "@/types";

/** Only these reach the query; anything else in the URL is ignored. */
const FILTER_KEYS = ["search", "actorId", "field", "kind", "bundleId", "dateFrom", "dateTo", "page", "pageSize", "order"] as const;

const ALL = "all";

function readUrl(params: URLSearchParams): AuditState {
  const state: AuditState = {};
  for (const key of FILTER_KEYS) {
    const value = params.get(key);
    if (value) state[key] = value;
  }
  return state;
}

function readForm(data: FormData): AuditState {
  const patch: AuditState = {};
  for (const key of ["search", "dateFrom", "dateTo"]) {
    const value = String(data.get(key) ?? "").trim();
    if (value) patch[key] = value;
  }
  return patch;
}

/**
 * Drops an empty value the way the bundle list does, so "All" removes the param from the URL
 * instead of sending a magic string the API would have to understand. `order` is the one
 * filter whose default is a real value (`desc`), and it never equals the "all" sentinel.
 */
function withFilter(state: AuditState, patch: AuditState): AuditState {
  const next: AuditState = {
    ...state,
    ...Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, value === ALL ? "" : value])),
  };
  for (const [key, value] of Object.entries(next)) {
    if (value === "" || value === undefined) delete next[key];
  }
  if (!("page" in patch)) delete next.page;
  return next;
}

/**
 * The admin's view of every change in the system. One table, four filters and the same
 * pagination control the bundle list uses — the log is the list's other half, so it is
 * drawn the same way and shares its page-size convention on purpose.
 */
export function AuditView({ facets }: { facets: AuditFacets }) {
  const searchParams = useSearchParams();
  const [state, setState] = useState<AuditState>(() => readUrl(searchParams));
  const query = useAuditQuery(state);

  const update = (next: AuditState) => {
    setState(next);
    window.history.replaceState(null, "", `/audit${toQuery(next)}`);
  };

  const reset = () => update({});

  const data = query.data;
  const rows = data?.items ?? [];
  const active = Object.keys(state).length > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Every field change and every comment in the system, newest first. This is the same history the bundle
          pages show, read from the other end: by who did it, not by which bundle it happened to.
        </p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          update(withFilter(state, readForm(new FormData(event.currentTarget))));
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="audit-search"
              name="search"
              defaultValue={state.search ?? ""}
              placeholder="Search by bundle name"
              className="h-8 w-64 pl-8"
              aria-label="Search the log by bundle name"
            />
          </div>

          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
          {active && (
            <Button type="button" size="sm" variant="ghost" onClick={reset}>
              <RotateCcwIcon />
              Reset
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect
            id="actorId"
            label="Who"
            value={state.actorId ?? ALL}
            options={[{ id: ALL, label: "Anyone" }, ...facets.actors]}
            onChange={(value) => update(withFilter(state, { actorId: value }))}
          />
          <FilterSelect
            id="field"
            label="Field"
            value={state.field ?? ALL}
            options={[{ id: ALL, label: "Any change" }, ...facets.fields.map((field) => ({ id: field, label: fieldLabel(field) }))]}
            onChange={(value) => update(withFilter(state, { field: value }))}
          />
          <FilterSelect
            id="kind"
            label="Type"
            value={state.kind ?? ALL}
            options={[
              { id: ALL, label: "Changes + comments" },
              { id: "change", label: "Changes only" },
              { id: "comment", label: "Comments only" },
            ]}
            onChange={(value) => update(withFilter(state, { kind: value }))}
          />
          <FilterSelect
            id="order"
            label="Order"
            value={state.order ?? "desc"}
            options={[
              { id: "desc", label: "Newest first" },
              { id: "asc", label: "Oldest first" },
            ]}
            onChange={(value) => update(withFilter(state, { order: value }))}
          />

          <div className="flex items-end gap-2">
            <DateField id="dateFrom" label="From" name="dateFrom" value={state.dateFrom ?? ""} />
            <DateField id="dateTo" label="To" name="dateTo" value={state.dateTo ?? ""} />
          </div>
        </div>
      </form>

      {data?.truncated && (
        <p className="text-xs text-warning">
          The log is merged from two tables over a bounded window, so these totals cover the most recent part of it —
          narrow the dates for an exact count.
        </p>
      )}

      {query.isPending ? (
        <TableSkeleton rows={6} />
      ) : query.isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Could not load the log: {query.error.message}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
          Nothing matches these filters.
        </p>
      ) : (
        <>
          <div className="rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">When</TableHead>
                  <TableHead className="w-36">Who</TableHead>
                  <TableHead className="w-56">Bundle</TableHead>
                  <TableHead>What happened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((entry) => (
                  <TableRow key={`${entry.kind}-${entry.id}`}>
                    <TableCell className="align-top text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatDateTime(entry.at)}
                    </TableCell>
                    <TableCell className="align-top text-xs">{entry.actor.label}</TableCell>
                    <TableCell className="max-w-56 align-top truncate text-xs">
                      <Link href={`/bundles/${entry.bundle.id}`} className="text-primary hover:underline">
                        {entry.bundle.label}
                      </Link>
                    </TableCell>
                    <TableCell className="align-top">
                      <WhatHappened entry={entry} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <TablePagination
            state={state}
            page={data?.page ?? 1}
            total={data?.total ?? 0}
            pageCount={data?.pageCount ?? 1}
            onChange={(next) => update(next)}
            emptyLabel="No entries"
          />
        </>
      )}

      {query.isFetching && !query.isPending && <p className="text-xs text-muted-foreground">Refreshing…</p>}
    </div>
  );
}

/**
 * One row of the log in words. `lib/timeline.ts` owns the vocabulary — the same call the
 * bundle feed makes — so a row cannot read one way on the bundle and another way here.
 */
function WhatHappened({ entry }: { entry: AuditEntry }) {
  if (entry.kind === "comment") {
    return (
      <p className="text-xs">
        <span className="text-muted-foreground">commented </span>
        <span className="break-words">“{entry.text}”</span>
      </p>
    );
  }

  const change = describeChange(entry.field ?? "", entry.oldValue, entry.newValue);

  if (change.isCreation) {
    return <p className="text-xs text-muted-foreground">{change.to}</p>;
  }

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{change.isStatus ? "status" : change.label}</span>

      {change.from !== null && (
        <>
          <span title={change.from} className="max-w-48 truncate text-muted-foreground line-through decoration-muted-foreground/40">
            {change.from}
          </span>
          <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground" />
        </>
      )}

      <span
        title={change.to}
        className={cn(
          "max-w-48 truncate rounded-md px-1.5 py-0.5",
          change.isStatus ? "border border-primary/30 bg-primary/10 text-primary" : "bg-muted",
        )}
      >
        {change.to}
      </span>
    </p>
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
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-8 w-44">
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
    </div>
  );
}

function DateField({ id, label, name, value }: { id: string; label: string; name: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={id} name={name} type="date" defaultValue={value} className="h-8 w-36" />
    </div>
  );
}
