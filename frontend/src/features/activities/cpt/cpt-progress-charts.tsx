"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartColors } from "@/components/charts/chart-tokens";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CptProgressPoint } from "@/features/activities/cpt/cpt-progress-data";

const tooltipContentStyle = {
  borderRadius: 10,
  border: `1px solid ${chartColors.tooltipBorder}`,
  boxShadow: "0 12px 24px -12px rgba(11, 28, 44, 0.28)",
  fontSize: 12,
} as const;

export function CptProgressCharts({ data }: { data: CptProgressPoint[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Accuracy trend</CardTitle>
            <CardDescription>
              Percentage of scored trials correct, oldest to newest.
            </CardDescription>
          </div>
          <Badge tone="outline">{data.length} runs</Badge>
        </CardHeader>
        <CardContent>
          <figure>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
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
                    dataKey="label"
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
                    contentStyle={tooltipContentStyle}
                    labelStyle={{
                      color: chartColors.ink,
                      fontWeight: 600,
                    }}
                    formatter={(value) => [`${value}%`, "Accuracy"]}
                    labelFormatter={(label) => `Run ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="accuracyPercent"
                    name="Accuracy"
                    stroke={chartColors.brand}
                    strokeWidth={2}
                    dot={{ r: 3, fill: chartColors.brand }}
                    activeDot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
                    isAnimationActive={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <figcaption className="mt-2 text-xs leading-5 text-ink-subtle">
              Accuracy counts correct detections and correct rejections divided
              by scored trials. It is a descriptive demo metric.
            </figcaption>
          </figure>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Reaction-time trend</CardTitle>
            <CardDescription>
              Mean hit reaction time for valid correct detections.
            </CardDescription>
          </div>
          <Badge tone="outline">ms</Badge>
        </CardHeader>
        <CardContent>
          <figure>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
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
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    dy={8}
                    tick={{ fill: chartColors.axis, fontSize: 11 }}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    width={52}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: chartColors.axis, fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{
                      stroke: chartColors.axis,
                      strokeDasharray: "4 4",
                    }}
                    contentStyle={tooltipContentStyle}
                    labelStyle={{
                      color: chartColors.ink,
                      fontWeight: 600,
                    }}
                    formatter={(value) =>
                      value === null || value === undefined
                        ? ["—", "Mean hit RT"]
                        : [`${value} ms`, "Mean hit RT"]
                    }
                    labelFormatter={(label) => `Run ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="meanHitReactionTimeMs"
                    name="Mean hit RT"
                    stroke={chartColors.accent}
                    strokeWidth={2}
                    dot={{ r: 3, fill: chartColors.accent }}
                    activeDot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
                    isAnimationActive={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <figcaption className="mt-2 text-xs leading-5 text-ink-subtle">
              Only correct detections with a valid response timestamp are
              included. Runs without a valid value appear as gaps.
            </figcaption>
          </figure>
        </CardContent>
      </Card>
    </div>
  );
}
