"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartColors } from "@/components/charts/chart-tokens";
import type { FocusTrendPoint } from "@/types";

export function FocusTrendChart({ data }: { data: FocusTrendPoint[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id="focus-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={chartColors.brandLight}
                stopOpacity={0.28}
              />
              <stop
                offset="100%"
                stopColor={chartColors.brandLight}
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke={chartColors.grid}
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="session"
            tickLine={false}
            axisLine={false}
            dy={8}
            tick={{ fill: chartColors.axis, fontSize: 11 }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            width={44}
            tickLine={false}
            axisLine={false}
            tick={{ fill: chartColors.axis, fontSize: 11 }}
          />
          <Tooltip
            cursor={{
              stroke: chartColors.axis,
              strokeDasharray: "4 4",
            }}
            contentStyle={{
              borderRadius: 10,
              border: `1px solid ${chartColors.tooltipBorder}`,
              boxShadow: "0 12px 24px -12px rgba(11, 28, 44, 0.28)",
              fontSize: 12,
            }}
            labelStyle={{ color: chartColors.ink, fontWeight: 600 }}
            formatter={(value) => [`${value}/100`, "Focus index (demo)"]}
            labelFormatter={(label) => `Session ${label}`}
          />
          <Area
            type="monotone"
            dataKey="focusIndex"
            name="Focus index"
            stroke={chartColors.brand}
            strokeWidth={2}
            fill="url(#focus-fill)"
            isAnimationActive={false}
            activeDot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
