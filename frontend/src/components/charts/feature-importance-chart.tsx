"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartColors } from "@/components/charts/chart-tokens";
import type { FeatureImportancePoint } from "@/types";

export function FeatureImportanceChart({
  data,
}: {
  data: FeatureImportancePoint[];
}) {
  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 20, bottom: 4, left: 8 }}
          accessibilityLayer
        >
          <CartesianGrid
            horizontal={false}
            stroke={chartColors.grid}
            strokeDasharray="3 3"
          />
          <XAxis type="number" hide domain={[0, 0.3]} />
          <YAxis
            type="category"
            dataKey="feature"
            width={150}
            tickLine={false}
            axisLine={false}
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
            formatter={(value) => [
              `${(Number(value) * 100).toFixed(0)}%`,
              "Relative importance (demo)",
            ]}
          />
          <Bar
            dataKey="importance"
            name="Relative importance"
            fill={chartColors.brand}
            radius={[0, 4, 4, 0]}
            barSize={14}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
