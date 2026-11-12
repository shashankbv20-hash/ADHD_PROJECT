"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors } from "@/components/charts/chart-tokens";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Metric, display, signed } from "@/features/backend/twin-summary-parts";
import type { ServerTwinInsights, TwinConfidence } from "@/lib/backend/twin";

const CONFIDENCE: Record<TwinConfidence, { label: string; tone: BadgeTone; detail: string }> = {
  insufficient: {
    label: "Not enough data",
    tone: "outline",
    detail: "Trends and comparisons need at least 2 saved runs.",
  },
  low: {
    label: "Low confidence",
    tone: "warning",
    detail: "2–4 runs. Differences between runs can easily be chance.",
  },
  moderate: {
    label: "Moderate confidence",
    tone: "brand",
    detail: "5–9 runs. Patterns are starting to be stable, but remain descriptive.",
  },
  higher: {
    label: "Higher confidence",
    tone: "success",
    detail: "10 or more runs. Still descriptive only; this is not a diagnosis.",
  },
};

function TrendChart({
  data,
  dataKey,
  label,
  unit,
  domain,
}: {
  data: ServerTwinInsights["trend"];
  dataKey: "accuracyPercent" | "meanHitReactionTimeMs";
  label: string;
  unit: string;
  domain?: [number, number];
}) {
  return (
    <figure className="space-y-1">
      <figcaption className="text-xs font-medium text-ink">{label}</figcaption>
      <div className="h-[160px] w-full" role="img" aria-label={`${label} across ${data.length} saved runs`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={chartColors.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="run"
              tickLine={false}
              axisLine={false}
              tick={{ fill: chartColors.axis, fontSize: 11 }}
              allowDecimals={false}
            />
            <YAxis
              domain={domain ?? ["auto", "auto"]}
              width={44}
              tickLine={false}
              axisLine={false}
              tick={{ fill: chartColors.axis, fontSize: 11 }}
            />
            <Tooltip
              formatter={(value) => [`${value}${unit}`, label]}
              labelFormatter={(run) => `Run ${run}`}
              contentStyle={{ borderRadius: 10, fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={chartColors.brand}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Twin v2: block metrics, reaction-time spread, trends, within-session change, confidence. */
export function TwinInsightsPanel({ insights }: { insights: ServerTwinInsights | null }) {
  if (!insights) {
    return (
      <p className="text-xs leading-5 text-ink-subtle">
        This version of the profile was calculated before block, spread and trend insights existed.
        The next saved run creates a new version that includes them.
      </p>
    );
  }

  const confidence = CONFIDENCE[insights.confidence];
  const hasTrend = insights.trend.length >= 2;

  return (
    <div className="space-y-5 border-t border-line/70 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">Detail from your saved runs</h3>
        <Badge tone={confidence.tone}>{confidence.label}</Badge>
        <span className="text-xs text-ink-subtle">{confidence.detail}</span>
      </div>

      {hasTrend ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <TrendChart
            data={insights.trend}
            dataKey="accuracyPercent"
            label="Accuracy by run"
            unit="%"
            domain={[0, 100]}
          />
          <TrendChart
            data={insights.trend}
            dataKey="meanHitReactionTimeMs"
            label="Mean hit reaction time by run"
            unit=" ms"
          />
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Run trends appear after at least 2 saved runs.</p>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
          Reaction-time spread
        </h4>
        {insights.spread ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Metric
              label="Typical spread (SD)"
              value={display(insights.spread.meanSdMs, " ms")}
              detail={`Average over ${insights.spread.runsUsed} run${insights.spread.runsUsed === 1 ? "" : "s"}`}
            />
            <Metric
              label="Relative spread (CV)"
              value={display(insights.spread.meanCv)}
              detail="SD divided by mean; lower is steadier"
            />
          </dl>
        ) : (
          <p className="text-sm text-ink-muted">
            Not enough correct responses to describe spread (at least 3 hits in a run are needed).
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
          Within a run (start to end)
        </h4>
        {insights.blockProfile.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-xs text-ink-muted">
              <caption className="sr-only">
                Average accuracy and reaction time for each block of a run
              </caption>
              <thead>
                <tr className="border-b border-line text-ink-subtle">
                  <th scope="col" className="py-1.5 pr-3 font-medium">
                    Block
                  </th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">
                    Runs
                  </th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">
                    Accuracy
                  </th>
                  <th scope="col" className="py-1.5 font-medium">
                    Mean hit RT
                  </th>
                </tr>
              </thead>
              <tbody>
                {insights.blockProfile.map((block) => (
                  <tr key={block.block} className="border-b border-line/60">
                    <th scope="row" className="py-1.5 pr-3 font-medium text-ink">
                      Block {block.block}
                    </th>
                    <td className="py-1.5 pr-3">{block.runs}</td>
                    <td className="py-1.5 pr-3 font-mono">{display(block.accuracyPercent, "%")}</td>
                    <td className="py-1.5 font-mono">{display(block.meanHitReactionTimeMs, " ms")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {insights.withinSession ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Metric
              label="Accuracy, last block vs first"
              value={signed(insights.withinSession.accuracyChangePoints, " pts")}
              detail={`Average over ${insights.withinSession.runsUsed} runs`}
            />
            <Metric
              label="Reaction time, last block vs first"
              value={signed(insights.withinSession.reactionTimeChangeMs, " ms")}
              detail="Positive means slower later in the run"
            />
          </dl>
        ) : (
          <p className="text-sm text-ink-muted">
            A start-to-end comparison (possible fatigue) needs at least 2 saved runs.
          </p>
        )}
        <p className="text-xs leading-5 text-ink-subtle">
          Blocks are short, so these figures only suggest a pattern. They are not a measure of fatigue
          or attention on their own.
        </p>
      </div>
    </div>
  );
}
