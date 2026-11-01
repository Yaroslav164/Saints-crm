"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DownloadIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkActionsBar } from "@/components/bundles/BulkActionsBar";
import { BundleDialog } from "@/components/bundles/BundleDialog";
import { BundleFilters } from "@/components/bundles/BundleFilters";
import { BundleTable, EmptyState, TablePagination, TableSkeleton } from "@/components/bundles/BundleTable";
import { toQuery } from "@/lib/api-client";
import { useBundlesQuery, type QueryState } from "@/hooks/useBundles";
import type { BundleFacets, BundleListItem } from "@/types";

/** Only these reach the query; anything else in the URL is ignored. */
const FILTER_KEYS = [
  "search",
  "status",
  "offerId",
  "userId",
  "geoId",
  "tagId",
  "roiMin",
  "roiMax",
  "dateFrom",
  "dateTo",
  "sort",
  "order",
  "page",
  "pageSize",
  "archived",
  "mine",
] as const;

function readUrl(params: URLSearchParams): QueryState {
  const state: QueryState = {};
  for (const key of FILTER_KEYS) {
    const value = params.get(key);
    if (value) state[key] = value;
  }
  return state;
}

/**
 * Owns the list state (filters, sort, page) and the row selection, and keeps the
 * address bar in sync with `history.replaceState` — a router navigation would
 * re-render the server component on every keystroke, while the URL only needs to
 * stay shareable and survive a refresh. The query string is read here instead of
 * being awaited by the page, so a navigation never blocks on it server-side.
 */
export function BundlesView({
  facets,
  isAdmin,
  currentUserId,
}: {
  facets: BundleFacets;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const searchParams = useSearchParams();
  const [state, setState] = useState<QueryState>(() => readUrl(searchParams));
  const [selected, setSelected] = useState<string[]>([]);
  const [formKey, setFormKey] = useState(0);
  // `?new=1` from the dashboard quick action opens the create dialog on arrival.
  const [dialog, setDialog] = useState<{ open: boolean; bundle: BundleListItem | null }>({
    open: Boolean(searchParams.get("new")),
    bundle: null,
  });
  const query = useBundlesQuery(state);

  const canManage = (row: BundleListItem) => isAdmin || row.buyer.id === currentUserId;

  const update = (next: QueryState) => {
    setState(next);
    // Rows the user can no longer see must not stay selected: bulk actions would
    // otherwise hit bundles that are not on screen.
    setSelected([]);
    window.history.replaceState(null, "", `/bundles${toQuery(next)}`);
  };

  const reset = () => {
    update({});
    setFormKey((value) => value + 1);
  };

  const toggleRow = (id: string, next: boolean) =>
    setSelected((current) => (next ? [...new Set([...current, id])] : current.filter((item) => item !== id)));

  const toggleAll = (next: boolean) =>
    setSelected(next ? (query.data?.items ?? []).map((item) => item.id) : []);

  const data = query.data;
  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Bundles</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} bundle${data.total === 1 ? "" : "s"} match the current filters.` : "Loading bundles…"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/bundles/export${toQuery(state)}`} download>
              <DownloadIcon />
              Export CSV
            </a>
          </Button>
          <Button type="button" size="sm" onClick={() => setDialog({ open: true, bundle: null })}>
            <PlusIcon />
            New bundle
          </Button>
        </div>
      </div>

      <BundleFilters state={state} facets={facets} formKey={formKey} onChange={update} onReset={reset} />

      <BulkActionsBar selectedIds={selected} isAdmin={isAdmin} onClear={() => setSelected([])} />

      {query.isPending ? (
        <TableSkeleton />
      ) : query.isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Could not load bundles: {query.error.message}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {data?.truncated && (
            <p className="text-xs text-warning">
              The ROI filter and ROI/CR sorting scan a limited window of matching rows — narrow the dates for an exact
              ordering.
            </p>
          )}
          <BundleTable
            rows={rows}
            state={state}
            onChange={update}
            selectedIds={selected}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            onEdit={(row) => setDialog({ open: true, bundle: row })}
            canManage={canManage}
          />
          <TablePagination
            state={state}
            page={data?.page ?? 1}
            total={data?.total ?? 0}
            pageCount={data?.pageCount ?? 1}
            onChange={update}
          />
        </>
      )}

      {query.isFetching && !query.isPending && (
        <p className="text-xs text-muted-foreground">Refreshing…</p>
      )}

      <BundleDialog
        facets={facets}
        isAdmin={isAdmin}
        bundle={dialog.bundle}
        open={dialog.open}
        onOpenChange={(open) => {
          setDialog((current) => ({ ...current, open }));
          // The dialog can arrive as ?new=1 from the dashboard; rewriting the URL
          // from the current state drops that marker so a reload does not reopen it.
          if (!open && window.location.search.includes("new=")) {
            window.history.replaceState(null, "", `/bundles${toQuery(state)}`);
          }
        }}
      />
    </div>
  );
}
