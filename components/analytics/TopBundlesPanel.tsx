"use client";

import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BundleStatusBadge } from "@/components/bundles/BundleStatusBadge";
import { useTopBundles, type WindowState } from "@/hooks/useAnalytics";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

const LIMIT = "8";

const signed = (value: number) => (value > 0 ? "text-success" : value < 0 ? "text-destructive" : "text-muted-foreground");

/**
 * Ranked bundles for the period. `order=asc` is the same query read from the other end,
 * which is the list a team needs before it decides what to drain — so the control flips
 * the direction instead of adding a second endpoint.
 */
export function TopBundlesPanel({ state, onChange }: { state: WindowState; onChange: (next: WindowState) => void }) {
  const best = (state.order ?? "desc") !== "asc";
  const query = useTopBundles({ ...state, limit: LIMIT });
  const rows = query.data?.rows ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Ranked on the window&apos;s own daily rows; a bundle without spend is left out — nothing proves its ROI.
        </p>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={best ? "default" : "outline"}
            onClick={() => onChange({ ...state, order: "desc" })}
          >
            <ArrowUpIcon />
            Best ROI
          </Button>
          <Button
            type="button"
            size="sm"
            variant={best ? "outline" : "default"}
            onClick={() => onChange({ ...state, order: "asc" })}
          >
            <ArrowDownIcon />
            Worst ROI
          </Button>
        </div>
      </div>

      {query.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="text-sm text-destructive">Could not load the ranking: {query.error.message}</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nothing spent in this period.</p>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bundle</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead className="text-right">CR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-64">
                      <Link href={`/bundles/${row.id}`} className="font-medium underline-offset-4 hover:underline">
                        {row.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{row.offer.label}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.buyer.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.spent)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.revenue)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", signed(row.profit))}>{formatCurrency(row.profit)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", signed(row.roi))}>{formatPercent(row.roi)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{row.cr.toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: the same rows as cards, columns being the first thing to go on a phone. */}
          <ul className="space-y-2 md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/bundles/${row.id}`} className="min-w-0 text-sm font-medium underline-offset-4 hover:underline">
                    {row.name}
                  </Link>
                  <BundleStatusBadge status={row.status} />
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {row.offer.label} · {row.buyer.label}
                </p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  {[
                    { label: "Spent", value: formatCurrency(row.spent) },
                    { label: "Profit", value: formatCurrency(row.profit), tone: row.profit },
                    { label: "ROI", value: formatPercent(row.roi), tone: row.roi },
                  ].map((item) => (
                    <div key={item.label}>
                      <dt className="text-muted-foreground">{item.label}</dt>
                      <dd className={cn("tabular-nums", item.tone === undefined ? undefined : signed(item.tone))}>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
