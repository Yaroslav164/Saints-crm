import Link from "next/link";
import {
  ArrowLeftIcon,
  CoinsIcon,
  HistoryIcon,
  MessageSquareIcon,
  TargetIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BundleActions } from "@/components/bundles/BundleActions";
import { BundleActivity } from "@/components/bundles/BundleActivity";
import { BundleStatusBadge } from "@/components/bundles/BundleStatusBadge";
import { CommentComposer } from "@/components/bundles/CommentComposer";
import { ProfitChart } from "@/components/dashboard/ProfitChart";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { cn, formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/utils";
import type { BundleDetail, BundleFacets } from "@/types";

/**
 * Detail screen: totals on top, the day-by-day series and the team thread on the
 * left, what the bundle is made of on the right. It is a server component — the only
 * interactivity is `BundleActions` and `CommentComposer`, each behind its own
 * boundary — so the whole page arrives in one render instead of waiting on a client
 * fetch, and an edit lands because those two call `router.refresh()`.
 */
export function BundleDetailView({
  bundle,
  facets,
  isAdmin,
  currentUserId,
}: {
  bundle: BundleDetail;
  facets: BundleFacets;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const tone = (value: number) => (value > 0 ? "positive" : value < 0 ? "negative" : "neutral");
  const commentCount = bundle.activity.filter((entry) => entry.kind === "comment").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <Link
            href="/bundles"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" />
            All bundles
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold break-words">{bundle.name}</h1>
            <BundleStatusBadge status={bundle.status} />
            {bundle.isArchived && (
              <Badge variant="outline" className="border-dashed">
                Archived
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {bundle.offer.label} · {bundle.buyer.label} ·{" "}
            <span className="font-mono text-xs">{bundle.geos.map((geo) => geo.label).join(", ")}</span>
          </p>
        </div>

        <BundleActions bundle={bundle} facets={facets} isAdmin={isAdmin} />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Spent"
          value={formatCurrency(bundle.budgetSpent)}
          hint={`${formatCurrency(bundle.budgetPlanned)} planned`}
          icon={<WalletIcon className="size-4" />}
        />
        <StatsCard
          title="Revenue"
          value={formatCurrency(bundle.revenue)}
          hint={`${formatNumber(bundle.conversions)} of ${formatNumber(bundle.clicks)} clicks`}
          icon={<TrendingUpIcon className="size-4" />}
        />
        <StatsCard
          title="ROI"
          value={formatPercent(bundle.roi)}
          hint={`${bundle.cr.toFixed(2)}% CR`}
          tone={tone(bundle.roi)}
          icon={<TargetIcon className="size-4" />}
        />
        <StatsCard
          title="Profit"
          value={formatCurrency(bundle.profit)}
          hint={`Updated ${formatDate(bundle.updatedAt)}`}
          tone={tone(bundle.profit)}
          icon={<CoinsIcon className="size-4" />}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="shadow-sm">
            <CardHeader className="px-4 pt-4 pb-0">
              <CardTitle className="text-sm">Profit by day</CardTitle>
              <CardDescription className="text-xs">
                {bundle.daily.length === 0
                  ? "Spend and revenue split by day, once anyone records them for this bundle."
                  : `Daily spend and revenue for this bundle, newest ${bundle.daily.length} days.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {bundle.daily.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No daily metrics recorded yet — the numbers on this bundle were never split by day.
                </p>
              ) : (
                <ProfitChart data={bundle.daily} height={200} />
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <HistoryIcon className="size-4 text-muted-foreground" />
                Activity &amp; comments
              </CardTitle>
              <CardDescription className="text-xs">
                {commentCount} comment{commentCount === 1 ? "" : "s"} · every field change is logged with the old and the
                new value.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <BundleActivity entries={bundle.activity} currentUserId={currentUserId} />
              <CommentComposer bundleId={bundle.id} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm">Bundle setup</CardTitle>
              <CardDescription className="text-xs">What is being tested and with what.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 text-sm">
              <Field label="Angle">{bundle.angle}</Field>
              <Field label="Creative">
                {bundle.creative ? (
                  <a
                    href={bundle.creative}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="break-all text-primary underline-offset-4 hover:underline"
                  >
                    {bundle.creative}
                  </a>
                ) : (
                  <Muted>Not recorded</Muted>
                )}
              </Field>
              <Field label="GEO">
                <span className="font-mono text-xs">{bundle.geos.map((geo) => geo.label).join(", ")}</span>
              </Field>
              <Field label="Tags">
                {bundle.tags.length === 0 ? (
                  <Muted>None</Muted>
                ) : (
                  <span className="flex flex-wrap gap-1.5">
                    {/* The dot holds the tag's own hue, the text stays on the theme tokens. */}
                    {bundle.tags.map((tag) => (
                      <Badge key={tag.id} variant="outline">
                        <span className="size-2 rounded-full" style={{ background: tag.color }} />
                        {tag.label}
                      </Badge>
                    ))}
                  </span>
                )}
              </Field>
              <Field label="Notes">
                {bundle.notes ? <span className="break-words whitespace-pre-wrap">{bundle.notes}</span> : <Muted>None</Muted>}
              </Field>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm">Numbers</CardTitle>
              <CardDescription className="text-xs">Totals as saved by the edit form.</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <dl className="divide-y divide-border text-sm">
                {[
                  { label: "Planned budget", value: formatCurrency(bundle.budgetPlanned) },
                  { label: "Spent", value: formatCurrency(bundle.budgetSpent) },
                  { label: "Revenue", value: formatCurrency(bundle.revenue) },
                  { label: "Clicks", value: formatNumber(bundle.clicks) },
                  { label: "Conversions", value: formatNumber(bundle.conversions) },
                  { label: "CR", value: `${bundle.cr.toFixed(2)}%` },
                  { label: "ROI", value: formatPercent(bundle.roi), tone: tone(bundle.roi) },
                  { label: "Profit", value: formatCurrency(bundle.profit), tone: tone(bundle.profit) },
                  { label: "Created", value: formatDate(bundle.createdAt) },
                  { label: "Last change", value: formatDate(bundle.updatedAt) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 py-1.5">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd
                      className={cn(
                        "tabular-nums",
                        row.tone === "positive" ? "text-success" : row.tone === "negative" ? "text-destructive" : undefined,
                      )}
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
              <MessageSquareIcon className="size-4 shrink-0" />
              Owner: {bundle.buyer.label}. Only {bundle.buyer.label} or an admin can edit these numbers.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
