"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_THEMES } from "@/lib/chart-theme";
import { useResolvedTheme } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";
import type { DayPoint } from "@/lib/dashboard";

type ProfitTooltipProps = {
  active?: boolean;
  payload?: readonly { payload?: DayPoint }[];
  label?: string | number;
  palette: (typeof CHART_THEMES)["dark"];
};

function MoneyTooltip({ active, payload, label, palette }: ProfitTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div
      className="rounded-xl px-3 py-2 text-xs shadow-lg"
      style={{
        background: palette.tooltip.background,
        border: `1px solid ${palette.tooltip.border}`,
        color: palette.tooltip.text,
      }}
    >
      <p className="mb-1 font-medium">{label}</p>
      <p style={{ color: palette.positive }}>Profit {formatCurrency(point.profit)}</p>
      <p style={{ color: palette.tooltip.muted }}>Revenue {formatCurrency(point.revenue)}</p>
      <p style={{ color: palette.tooltip.muted }}>Spent {formatCurrency(point.spent)}</p>
    </div>
  );
}

/** Daily team profit — one point per calendar day, gaps filled with zero. */
export function ProfitChart({ data, height = 260 }: { data: DayPoint[]; height?: number }) {
  const theme = useResolvedTheme();
  const palette = CHART_THEMES[theme];
  const tick = { fontSize: 11, fill: palette.axis };

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={tick}
            tickLine={false}
            axisLine={{ stroke: palette.grid }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={tick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => `$${Math.round(value)}`}
            width={64}
          />
          <Tooltip
            content={<MoneyTooltip palette={palette} />}
            cursor={{ stroke: palette.axis, strokeDasharray: "3 3" }}
          />
          <ReferenceLine y={0} stroke={palette.baseline} strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="profit"
            name="Profit"
            stroke={palette.line}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
