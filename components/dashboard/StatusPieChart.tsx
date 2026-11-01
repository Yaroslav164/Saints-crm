"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { StatusSlice } from "@/lib/dashboard";

/**
 * Distribution of active (non-archived) bundles by status. Colours come from
 * STATUS_META so the pie, the badges and the table agree on one meaning.
 */
export function StatusPieChart({ data, height = 260 }: { data: StatusSlice[]; height?: number }) {
  const total = data.reduce((sum, slice) => sum + slice.count, 0);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div style={{ height }} className="w-full sm:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 8,
                fontSize: 12,
              }}
              itemStyle={{ color: "#e2e8f0" }}
              formatter={(value, name) => [`${value} bundles`, name]}
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={2}
              isAnimationActive={false}
            >
              {data.map((slice) => (
                <Cell key={slice.status} fill={slice.color} stroke="#020617" strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="grid flex-1 gap-1.5 text-sm">
        {data.map((slice) => (
          <li key={slice.status} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
            <span className="truncate text-muted-foreground">
              {slice.emoji} {slice.label}
            </span>
            <span className="ml-auto tabular-nums">
              {slice.count}
              <span className="ml-1 text-xs text-muted-foreground">
                {total ? `${Math.round((slice.count / total) * 100)}%` : "0%"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
