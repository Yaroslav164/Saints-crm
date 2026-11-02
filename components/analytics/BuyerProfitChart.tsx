"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_THEMES } from "@/lib/chart-theme";
import { useResolvedTheme } from "@/lib/theme";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { BuyerSlice } from "@/types";

/** "Ivan Ivanov" → "Ivan I." — a category axis has no room for a full name, a tooltip has. */
function shortName(label: string): string {
  const [first, last] = label.split(" ");
  if (!last) return first ?? label;
  return `${first} ${last[0]}.`;
}

type Row = { name: string; short: string; profit: number; revenue: number; spent: number; roi: number; bundles: number };

function BuyerTooltip({
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
        Profit {formatCurrency(row.profit)} · {formatPercent(row.roi)}
      </p>
      <p style={{ color: palette.tooltip.muted }}>Revenue {formatCurrency(row.revenue)}</p>
      <p style={{ color: palette.tooltip.muted }}>Spent {formatCurrency(row.spent)}</p>
      <p style={{ color: palette.tooltip.muted }}>
        {row.bundles} bundle{row.bundles === 1 ? "" : "s"} in the period
      </p>
    </div>
  );
}

/**
 * Profit per buyer over the period. Horizontal because the names are the labels worth
 * reading, and a rotated axis is how a bar chart becomes a puzzle. The bar keeps the
 * theme's positive/negative pair: which side of zero a buyer is on is the whole point.
 */
export function BuyerProfitChart({ rows }: { rows: BuyerSlice[] }) {
  const theme = useResolvedTheme();
  const palette = CHART_THEMES[theme];
  const data: Row[] = rows.map((row) => ({
    name: row.buyer.label,
    short: shortName(row.buyer.label),
    profit: row.profit,
    revenue: row.revenue,
    spent: row.spent,
    roi: row.roi,
    bundles: row.bundles,
  }));

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No spend recorded in this period.</p>;
  }

  return (
    <div style={{ height: Math.max(160, data.length * 42 + 28) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
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
            width={72}
            tick={{ fontSize: 11, fill: palette.axis }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<BuyerTooltip palette={palette} />} cursor={{ fill: palette.grid, fillOpacity: 0.35 }} />
          <Bar dataKey="profit" name="Profit" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((row) => (
              <Cell key={row.name} fill={row.profit >= 0 ? palette.positive : palette.negative} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
