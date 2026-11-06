"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  bandColors,
  chartColors,
} from "@/components/charts/chart-tokens";
import type { BandPowerPoint } from "@/types";

export function BandPowerChart({ data }: { data: BandPowerPoint[] }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          accessibilityLayer
        >
          <CartesianGrid
            vertical={false}
            stroke={chartColors.grid}
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="band"
            tickLine={false}
            axisLine={false}
            dy={8}
            tick={{ fill: chartColors.axis, fontSize: 11 }}
          />
          <YAxis
            domain={[0, 40]}
            ticks={[0, 10, 20, 30, 40]}
            width={44}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
            tick={{ fill: chartColors.axis, fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(11, 28, 44, 0.04)" }}
            contentStyle={{
              borderRadius: 10,
              border: `1px solid ${chartColors.tooltipBorder}`,
              boxShadow: "0 12px 24px -12px rgba(11, 28, 44, 0.28)",
              fontSize: 12,
            }}
            labelStyle={{ color: chartColors.ink, fontWeight: 600 }}
            formatter={(value) => [`${value}%`, "Relative power (demo)"]}
          />
          <Bar
            dataKey="relativePower"
            name="Relative power"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.band}
                fill={bandColors[index % bandColors.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
