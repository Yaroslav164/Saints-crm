"use client";

import { useMemo } from "react";
import { createColumnHelper, tableFeatures, useTable, type Row } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BundleStatusBadge } from "@/components/bundles/BundleStatusBadge";
import { cn, formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/utils";
import { readSort, withParams, type QueryState } from "@/hooks/useBundles";
import type { BundleListItem } from "@/types";

/**
 * Column and row model come from TanStack Table; row selection is deliberately
 * *not* a table feature because the bulk bar has to see it across both the table
 * and the mobile card list, so the parent owns it and passes it down.
 */
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, BundleListItem>();

type ColumnMeta = {
  label?: string;
  sortable?: boolean;
  /** Column used for the server sort when it differs from the accessor id. */
  sortKey?: string;
  numeric?: boolean;
  className?: string;
};

const money = (value: number) => formatCurrency(value);
const signed = (value: number) => (value > 0 ? "text-success" : value < 0 ? "text-destructive" : undefined);

/**
 * One declaration per column: label, alignment, which server sort it drives and
 * at which breakpoint it collapses. Selection checkboxes are rendered by the
 * table itself (see below) because their state is lifted to the parent.
 */
const columns = helper.columns([
  helper.accessor("name", {
    header: "Bundle",
    cell: (info) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{info.row.original.name}</p>
        <p className="truncate text-xs text-muted-foreground">{info.row.original.angle}</p>
      </div>
    ),
    meta: { label: "Name", sortable: true, className: "min-w-44" } satisfies ColumnMeta,
  }),
  helper.accessor("offer", {
    header: "Offer",
    cell: (info) => <span className="truncate">{info.row.original.offer.label}</span>,
    meta: { label: "Offer", sortable: true, sortKey: "offer" } satisfies ColumnMeta,
  }),
  helper.accessor("geos", {
    header: "GEO",
    cell: (info) => <span className="font-mono text-xs">{info.row.original.geos.map((geo) => geo.label).join(", ")}</span>,
    meta: { label: "GEO", className: "hidden lg:table-cell" } satisfies ColumnMeta,
  }),
  helper.accessor("buyer", {
    header: "Buyer",
    cell: (info) => info.row.original.buyer.label,
    meta: { label: "Buyer", sortable: true, sortKey: "buyer" } satisfies ColumnMeta,
  }),
  helper.accessor("status", {
    header: "Status",
    cell: (info) => <BundleStatusBadge status={info.row.original.status} />,
    meta: { label: "Status", sortable: true } satisfies ColumnMeta,
  }),
  helper.accessor("budgetPlanned", {
    header: "Planned",
    cell: (info) => money(info.getValue()),
    meta: { label: "Planned", sortable: true, numeric: true, className: "hidden xl:table-cell" } satisfies ColumnMeta,
  }),
  helper.accessor("budgetSpent", {
    header: "Spent",
    cell: (info) => money(info.getValue()),
    meta: { label: "Spent", sortable: true, numeric: true } satisfies ColumnMeta,
  }),
  helper.accessor("revenue", {
    header: "Revenue",
    cell: (info) => money(info.getValue()),
    meta: { label: "Revenue", sortable: true, numeric: true } satisfies ColumnMeta,
  }),
  helper.accessor("clicks", {
    header: "Clicks",
    cell: (info) => formatNumber(info.getValue()),
    meta: { label: "Clicks", sortable: true, numeric: true, className: "hidden lg:table-cell" } satisfies ColumnMeta,
  }),
  helper.accessor("conversions", {
    header: "Conv",
    cell: (info) => formatNumber(info.getValue()),
    meta: { label: "Conv", sortable: true, numeric: true, className: "hidden lg:table-cell" } satisfies ColumnMeta,
  }),
  helper.accessor("cr", {
    header: "CR",
    cell: (info) => `${info.getValue().toFixed(2)}%`,
    meta: { label: "CR", sortable: true, sortKey: "cr", numeric: true, className: "hidden xl:table-cell" } satisfies ColumnMeta,
  }),
  helper.accessor("roi", {
    header: "ROI",
    cell: (info) => (
      <span className={cn("tabular-nums", signed(info.getValue()))}>{formatPercent(info.getValue())}</span>
    ),
    meta: { label: "ROI", sortable: true, numeric: true } satisfies ColumnMeta,
  }),
  helper.accessor("profit", {
    header: "Profit",
    cell: (info) => (
      <span className={cn("tabular-nums", signed(info.getValue()))}>{money(info.getValue())}</span>
    ),
    meta: { label: "Profit", sortable: true, numeric: true } satisfies ColumnMeta,
  }),
  helper.accessor("updatedAt", {
    header: "Updated",
    cell: (info) => formatDate(info.getValue()),
    meta: { label: "Updated", sortable: true, className: "hidden xl:table-cell" } satisfies ColumnMeta,
  }),
]);

function metaFor(column: { columnDef: { meta?: unknown } }): ColumnMeta {
  return (column.columnDef.meta ?? {}) as ColumnMeta;
}

export function BundleTable({
  rows,
  state,
  onChange,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onEdit,
  canManage,
}: {
  rows: BundleListItem[];
  state: QueryState;
  onChange: (next: QueryState) => void;
  selectedIds: string[];
  onToggleRow: (id: string, next: boolean) => void;
  onToggleAll: (next: boolean) => void;
  onEdit: (row: BundleListItem) => void;
  canManage: (row: BundleListItem) => boolean;
}) {
  const actionsColumn = useMemo(
    () =>
      helper.display({
        id: "actions",
        header: "",
        cell: (info) => {
          const row = info.row.original;
          if (!canManage(row)) return null;
          return (
            <Button type="button" size="xs" variant="ghost" onClick={() => onEdit(row)}>
              Edit
            </Button>
          );
        },
        // Width via a class: `size` only applies when columnSizingFeature is on.
        meta: { label: "", className: "w-16" } satisfies ColumnMeta,
      }),
    [onEdit, canManage],
  );

  const table = useTable({
    features,
    columns: [...columns, actionsColumn],
    data: rows,
    getRowId: (row) => row.id,
  });

  const { sort, order } = readSort(state);
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const dataRows = table.getRowModel().rows;

  // Sorting is server-side and lives in the URL, so the header drives the query
  // state directly rather than keeping a second sort state inside the table.
  const toggleSort = (columnId: string) =>
    onChange(
      withParams(state, {
        sort: columnId,
        order: sort === columnId && order === "desc" ? "asc" : "desc",
      }),
    );

  const sortableHead = (meta: ColumnMeta, fallback: string) => {
    const label = meta.label ?? fallback;
    const columnId = meta.sortKey ?? fallback;
    const active = Boolean(meta.sortable) && sort === columnId;

    return (
      <button
        type="button"
        disabled={!meta.sortable}
        onClick={() => toggleSort(columnId)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium",
          meta.sortable ? "hover:text-foreground" : "cursor-default",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {active ? (
          order === "asc" ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />
        ) : meta.sortable ? (
          <ChevronsUpDownIcon className="size-3 opacity-50" />
        ) : null}
      </button>
    );
  };

  return (
    <>
      {/* Tablet and desktop: full table */}
      <div className="hidden overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-9">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(value) => onToggleAll(value === true)}
                  aria-label="Select all rows on this page"
                />
              </TableHead>
              {table.getAllLeafColumns().map((column) => {
                const meta = metaFor(column);
                return (
                  <TableHead key={column.id} className={cn(meta.numeric && "text-right", meta.className)}>
                    {sortableHead(meta, column.id)}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataRows.map((row) => (
              <TableRow
                key={row.id}
                data-state={selectedIds.includes(row.id) ? "selected" : undefined}
                className="transition-colors hover:bg-muted/60"
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(row.id)}
                    onCheckedChange={(value) => onToggleRow(row.id, value === true)}
                    aria-label={`Select ${row.original.name}`}
                  />
                </TableCell>
                {row.getAllCells().map((cell) => {
                  const meta = metaFor(cell.column);
                  return (
                    <TableCell key={cell.id} className={cn(meta.numeric && "text-right", meta.className)}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Phones: cards instead of a table, as the spec asks */}
      <div className="space-y-2 md:hidden">
        {dataRows.map((row) => (
          <BundleCard
            key={row.id}
            row={row}
            selected={selectedIds.includes(row.id)}
            onToggle={(next) => onToggleRow(row.id, next)}
            onEdit={canManage(row.original) ? () => onEdit(row.original) : undefined}
          />
        ))}
      </div>
    </>
  );
}

function BundleCard({
  row,
  selected,
  onToggle,
  onEdit,
}: {
  row: Row<typeof features, BundleListItem>;
  selected: boolean;
  onToggle: (next: boolean) => void;
  onEdit?: () => void;
}) {
  const bundle = row.original;

  return (
    <article
      className={cn(
        "space-y-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10",
        selected ? "ring-2 ring-primary" : "",
      )}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={selected}
          onCheckedChange={(value) => onToggle(value === true)}
          aria-label={`Select ${bundle.name}`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{bundle.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {bundle.offer.label} · {bundle.buyer.label} · {bundle.geos.map((geo) => geo.label).join(", ")}
          </p>
        </div>
        <BundleStatusBadge status={bundle.status} />
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{bundle.angle}</p>
      <dl className="grid grid-cols-3 gap-2 text-xs">
        {[
          { label: "Spent", value: formatCurrency(bundle.budgetSpent) },
          { label: "Revenue", value: formatCurrency(bundle.revenue) },
          { label: "ROI", value: formatPercent(bundle.roi), tone: bundle.roi },
        ].map((item) => (
          <div key={item.label} className="space-y-0.5">
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className={cn("tabular-nums", item.tone === undefined ? undefined : signed(item.tone))}>{item.value}</dd>
          </div>
        ))}
      </dl>
      {onEdit && (
        <div className="pt-1">
          <Button type="button" size="sm" variant="outline" onClick={onEdit}>
            Edit
          </Button>
        </div>
      )}
    </article>
  );
}

export function TablePagination({
  state,
  page,
  total,
  pageCount,
  onChange,
}: {
  state: QueryState;
  /** Effective page from the API: the requested one may have been clamped. */
  page: number;
  total: number;
  pageCount: number;
  onChange: (next: QueryState) => void;
}) {
  const pageSize = Number.parseInt(state.pageSize ?? "20", 10) || 20;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        {total === 0 ? "No bundles" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(value) => onChange(withParams(state, { pageSize: value }))}>
          <SelectTrigger size="sm" className="h-8 w-20" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[20, 50, 100].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onChange({ ...state, page: String(Math.max(1, page - 1)) })}
        >
          Previous
        </Button>
        <span className="tabular-nums text-muted-foreground">
          {page} / {pageCount}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page >= pageCount}
          onClick={() => onChange({ ...state, page: String(Math.min(pageCount, page + 1)) })}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/60 p-10 text-center">
      <Badge variant="outline" className="mb-2">
        0 results
      </Badge>
      <p className="text-sm text-muted-foreground">No bundle matches these filters. Reset them or create a new bundle.</p>
    </div>
  );
}
