import Link from "next/link";
import {
  FlaskConicalIcon,
  PlusIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfitChart } from "@/components/dashboard/ProfitChart";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { StatusPieChart } from "@/components/dashboard/StatusPieChart";
import { TopBundlesWidget } from "@/components/dashboard/TopBundlesWidget";
import { getDashboardData } from "@/lib/dashboard";
import { requirePageUser } from "@/lib/dal";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requirePageUser();
  const data = await getDashboardData(user.id);

  const profitTone = data.totals.profit > 0 ? "positive" : data.totals.profit < 0 ? "negative" : "neutral";

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Team numbers for the last {data.windowDays} days, {user.name.toLowerCase()}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/bundles?new=1">
              <PlusIcon />
              New bundle
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/bundles?status=TESTING&amp;mine=1">
              <FlaskConicalIcon />
              My active tests ({data.myTesting})
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="In testing"
          value={String(data.counts.TESTING)}
          hint={`${data.counts.IDEA} ideas waiting`}
          icon={<FlaskConicalIcon className="size-4" />}
        />
        <StatsCard
          title="In profit"
          value={String(data.counts.PROFIT)}
          hint={`${data.counts.SCALE} scaling`}
          tone="positive"
          icon={<TrendingUpIcon className="size-4" />}
        />
        <StatsCard
          title="In loss"
          value={String(data.counts.LOSS)}
          hint={`${data.counts.DRAINED} drained`}
          tone="negative"
          icon={<TrendingDownIcon className="size-4" />}
        />
        <StatsCard
          title={`Profit / ${data.windowDays}d`}
          value={formatCurrency(data.totals.profit)}
          hint={`${formatPercent(data.totals.roi)} on ${formatCurrency(data.totals.spent)} spent`}
          tone={profitTone}
          icon={<WalletIcon className="size-4" />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="px-4 pt-4 pb-0">
            <CardTitle className="text-sm">Profit by day</CardTitle>
            <CardDescription className="text-xs">
              Sum of every bundle&apos;s daily metrics — negative days mean the team spent more than it earned.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ProfitChart data={data.profitByDay} />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="px-4 pt-4 pb-0">
            <CardTitle className="text-sm">Bundles by status</CardTitle>
            <CardDescription className="text-xs">Active bundles (archived excluded).</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <StatusPieChart data={data.statusSlices} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <TopBundlesWidget bundles={data.topBundles} className="lg:col-span-2" />

        <Card className="shadow-sm">
          <CardHeader className="px-4 pt-4 pb-0">
            <CardTitle className="text-sm">Month totals</CardTitle>
            <CardDescription className="text-xs">Team-wide, last {data.windowDays} days.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <dl className="divide-y divide-border text-sm">
              {[
                { label: "Revenue", value: formatCurrency(data.totals.revenue) },
                { label: "Spent", value: formatCurrency(data.totals.spent) },
                {
                  label: "Profit",
                  value: formatCurrency(data.totals.profit),
                  className: profitTone === "positive" ? "text-success" : profitTone === "negative" ? "text-destructive" : undefined,
                },
                { label: "ROI", value: formatPercent(data.totals.roi) },
                { label: "My active tests", value: String(data.myTesting) },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className={`tabular-nums ${row.className ?? ""}`}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
