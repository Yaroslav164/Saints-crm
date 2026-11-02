"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleDollarSignIcon, PercentIcon, PiggyBankIcon, WalletIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { BuyerProfitChart } from "@/components/analytics/BuyerProfitChart";
import { OfferPerformanceChart } from "@/components/analytics/OfferPerformanceChart";
import { PeriodPicker } from "@/components/analytics/PeriodPicker";
import { StatusFunnel, funnelHeadline } from "@/components/analytics/StatusFunnel";
import { TopBundlesPanel } from "@/components/analytics/TopBundlesPanel";
import { toQuery } from "@/lib/api-client";
import { useAnalyticsByBuyer, useAnalyticsByOffer, useAnalyticsSummary, type WindowState } from "@/hooks/useAnalytics";
import { cn, formatCurrency, formatDayLabel, formatPercent, formatNumber } from "@/lib/utils";

const DEFAULT_DAYS = "30";

function readUrl(params: URLSearchParams): WindowState {
  const state: WindowState = {};
  for (const key of ["days", "from", "to", "order"]) {
    const value = params.get(key);
    if (value) state[key] = value;
  }
  return state;
}

/** Delta copy for a card: the same period one step back, which is what makes a number mean something. */
function delta(change: number, money = false): string {
  if (!Number.isFinite(change) || change === 0) return "flat against the previous period";
  const shown = money ? formatCurrency(Math.abs(change)) : `${Math.abs(change).toFixed(1)} pp`;
  return `${change > 0 ? "+" : "−"}${shown} vs the previous period`;
}

/**
 * Analytics screen. The period is URL state owned by the client (same contract as the
 * bundle list: the server never awaits it), and every card reads its own endpoint, so
 * switching a period re-fetches four queries instead of re-rendering a server page.
 */
export function AnalyticsView() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<WindowState>(() => readUrl(searchParams));

  const summary = useAnalyticsSummary(state);
  const buyers = useAnalyticsByBuyer(state);
  const offers = useAnalyticsByOffer(state);

  const update = (next: WindowState) => {
    const cleaned: WindowState = {};
    for (const [key, value] of Object.entries(next)) {
      if (value) cleaned[key] = value;
    }
    setState(cleaned);
    window.history.replaceState(null, "", `/analytics${toQuery(cleaned)}`);
  };

  const data = summary.data;
  const period = data?.window;
  const profitTone = !period ? "neutral" : data.totals.profit > 0 ? "positive" : data.totals.profit < 0 ? "negative" : "neutral";

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            {period
              ? `${formatDayLabel(period.from)} – ${formatDayLabel(period.to)} · ${period.days} days of daily metric rows, archived bundles included.`
              : "Reading the period…"}
          </p>
        </div>
        <PeriodPicker state={state} defaultDays={DEFAULT_DAYS} onChange={update} />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.isPending ? (
          [0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-24 rounded-xl" />)
        ) : data ? (
          <>
            <StatsCard
              title="Profit"
              value={formatCurrency(data.totals.profit)}
              hint={delta(data.profitChange, true)}
              tone={profitTone}
              icon={<WalletIcon className="size-4" />}
            />
            <StatsCard
              title="Revenue"
              value={formatCurrency(data.totals.revenue)}
              hint={`${formatNumber(data.totals.conversions)} conversions · CR ${data.totals.cr.toFixed(2)}%`}
              icon={<CircleDollarSignIcon className="size-4" />}
            />
            <StatsCard
              title="Spent"
              value={formatCurrency(data.totals.spent)}
              hint={`${data.totals.bundles} bundle${data.totals.bundles === 1 ? "" : "s"} spent in the period`}
              icon={<PiggyBankIcon className="size-4" />}
            />
            <StatsCard
              title="Team ROI"
              value={formatPercent(data.totals.roi)}
              hint={`Mean per bundle ${formatPercent(data.avgBundleRoi)}`}
              tone={data.totals.roi > 0 ? "positive" : data.totals.roi < 0 ? "negative" : "neutral"}
              icon={<PercentIcon className="size-4" />}
            />
          </>
        ) : (
          <div className="text-sm text-destructive sm:col-span-2 xl:col-span-4">{summary.error.message}</div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm">Profit by buyer</CardTitle>
            <CardDescription className="text-xs">
              Who carried the period. Negative bars are money the team will not see again.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {buyers.isPending ? (
              <Skeleton className="mx-2 mb-2 h-40 rounded-lg" />
            ) : buyers.isError ? (
              <p className="px-2 text-sm text-destructive">{buyers.error.message}</p>
            ) : (
              <BuyerProfitChart rows={buyers.data.rows} />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm">Offer performance</CardTitle>
            <CardDescription className="text-xs">
              Spend against revenue per offer — the ratio alone hides the size of the bet.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {offers.isPending ? (
              <Skeleton className="mx-2 mb-2 h-40 rounded-lg" />
            ) : offers.isError ? (
              <p className="px-2 text-sm text-destructive">{offers.error.message}</p>
            ) : (
              <OfferPerformanceChart rows={offers.data.rows} />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm">From idea to scale</CardTitle>
            <CardDescription className="text-xs">{data ? funnelHeadline(data.funnel) : "Counting the active bundles…"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            {summary.isPending || !data ? (
              <Skeleton className="h-40 rounded-lg" />
            ) : (
              <>
                <StatusFunnel stages={data.funnel} />
                <dl className="divide-y divide-border text-sm">
                  <div className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-muted-foreground">Bundles in profit</dt>
                    <dd className={cn("tabular-nums", data.profitableShare > 0 ? "text-success" : undefined)}>
                      {data.profitableShare}% of those that spent
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-muted-foreground">Archived</dt>
                    <dd className="tabular-nums">{data.counts.archived}</dd>
                  </div>
                </dl>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-sm">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm">Top bundles for the period</CardTitle>
          <CardDescription className="text-xs">
            Same window as the cards above; the ranking is the period&apos;s own numbers, not the lifetime totals.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <TopBundlesPanel state={state} onChange={update} />
        </CardContent>
      </Card>
    </div>
  );
}
