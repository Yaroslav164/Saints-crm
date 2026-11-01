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
import { formatCurrency } from "@/lib/utils";
import type { DayPoint } from "@/lib/dashboard";

const AXIS = "rgb(148 163 184 / 0.7)";
const GRID = "rgb(30 41 59 / 0.9)";

type ProfitTooltipProps = {
  active?: boolean;
  payload?: readonly { payload?: DayPoint }[];
  label?: string | number;
};

function MoneyTooltip({ active, payload, label }: ProfitTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-200">{label}</p>
      <p className="text-emerald-400">Profit {formatCurrency(point.profit)}</p>
      <p className="text-slate-400">Revenue {formatCurrency(point.revenue)}</p>
      <p className="text-slate-400">Spent {formatCurrency(point.spent)}</p>
    </div>
  );
}

/** Daily team profit — one point per calendar day, gaps filled with zero. */
export function ProfitChart({ data, height = 260 }: { data: DayPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: AXIS }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: AXIS }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => `$${Math.round(value)}`}
            width={64}
          />
          <Tooltip content={<MoneyTooltip />} cursor={{ stroke: AXIS, strokeDasharray: "3 3" }} />
          <ReferenceLine y={0} stroke={AXIS} strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="profit"
            name="Profit"
            stroke="#6366f1"
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
