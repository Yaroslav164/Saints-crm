"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_THEMES } from "@/lib/chart-theme";
import { useResolvedTheme } from "@/lib/theme";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type { OfferSlice } from "@/types";

/** Offers are named "<vertical> <geo>", and the first word is the vertical. */
function shortName(label: string): string {
  return label.split(" ")[0] ?? label;
}

type Row = {
  name: string;
  short: string;
  revenue: number;
  spent: number;
  profit: number;
  roi: number;
  cr: number;
  conversions: number;
  payoutUSD: number;
};

function OfferTooltip({
  active,
  payload,
  palette,
}: {
  active?: boolean;
  payload?: readonly { payload?: Row }[];
  palette: (typeof CHART_THEMES)["dark"];
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div
      className="rounded-xl px-3 py-2 text-xs shadow-lg"
      style={{
        background: palette.tooltip.background,
        border: `1px solid ${palette.tooltip.border}`,
        color: palette.tooltip.text,
      }}
    >
      <p className="mb-1 font-medium">{row.name}</p>
      <p style={{ color: row.profit >= 0 ? palette.positive : palette.negative }}>
        {formatCurrency(row.profit)} · ROI {formatPercent(row.roi)}
      </p>
      <p style={{ color: palette.tooltip.muted }}>Revenue {formatCurrency(row.revenue)}</p>
      <p style={{ color: palette.tooltip.muted }}>Spent {formatCurrency(row.spent)}</p>
      <p style={{ color: palette.tooltip.muted }}>
        CR {row.cr.toFixed(2)}% · {formatNumber(row.conversions)} conversions · payout {formatCurrency(row.payoutUSD)}
      </p>
    </div>
  );
}

/**
 * Revenue against spend per offer. Two bars rather than one ROI line because the
 * ratio alone hides the size of the bet: +200% on $40 and +200% on $4,000 are not the
 * same decision, and this chart is where that difference becomes visible.
 */
export function OfferPerformanceChart({ rows }: { rows: OfferSlice[] }) {
  const theme = useResolvedTheme();
  const palette = CHART_THEMES[theme];
  const data: Row[] = rows.map((row) => ({
    name: row.offer.label,
    short: shortName(row.offer.label),
    revenue: row.revenue,
    spent: row.spent,
    profit: row.profit,
    roi: row.roi,
    cr: row.cr,
    conversions: row.conversions,
    payoutUSD: row.payoutUSD,
  }));

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No offer activity in this period.</p>;
  }

  return (
    <div style={{ height: Math.max(180, data.length * 46 + 34) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, bottom: 0, left: 4 }} barGap={2}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: palette.axis }}
            tickLine={false}
            axisLine={{ stroke: palette.grid }}
            tickFormatter={(value: number) => `$${Math.round(value)}`}
          />
          <YAxis
            type="category"
            dataKey="short"
            width={84}
            tick={{ fontSize: 11, fill: palette.axis }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<OfferTooltip palette={palette} />} cursor={{ fill: palette.grid, fillOpacity: 0.35 }} />
          <Legend wrapperStyle={{ fontSize: 11, color: palette.axis }} />
          <Bar dataKey="spent" name="Spent" fill={palette.muted} radius={[0, 3, 3, 0]} barSize={9} isAnimationActive={false} />
          <Bar dataKey="revenue" name="Revenue" fill={palette.line} radius={[0, 3, 3, 0]} barSize={9} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
