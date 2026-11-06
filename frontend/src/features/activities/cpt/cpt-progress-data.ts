import { CPT_SCORED_TRIALS } from "@/features/activities/cpt/cpt-config";
import {
  aggregateCptMetrics,
  calculateCptMetrics,
} from "@/features/activities/cpt/scoring";
import type { CptMetrics, CptRunSummary } from "@/types";

export interface CptProgressPoint {
  label: string;
  runId: string;
  completedAt: string;
  accuracyPercent: number | null;
  meanHitReactionTimeMs: number | null;
}

export interface CptProgressSummary {
  scoredRuns: CptRunSummary[];
  aggregate: CptMetrics;
  latestRun: CptRunSummary | null;
  baselineRun: CptRunSummary | null;
  completeTrialLogCount: number;
  trendPoints: CptProgressPoint[];
  hasTrend: boolean;
}

export function buildCptProgressSummary(
  runs: readonly CptRunSummary[],
): CptProgressSummary {
  const scoredRuns = runs.filter((run) => run.mode === "scored");
  const allRunsHaveTrialEvents = scoredRuns.every(
    (run) => run.events.length === run.trialCount,
  );
  const aggregate = allRunsHaveTrialEvents
    ? calculateCptMetrics(scoredRuns.flatMap((run) => run.events))
    : aggregateCptMetrics(
        scoredRuns.map((run) =>
          run.events.length === 0 && run.trialCount > 0
            ? run
            : calculateCptMetrics(run.events),
        ),
      );
  const latestRun = scoredRuns[0] ?? null;
  const baselineRun =
    scoredRuns.length > 0 ? scoredRuns[scoredRuns.length - 1] : null;

  const trendPoints: CptProgressPoint[] = [...scoredRuns]
    .reverse()
    .map((run, index) => ({
      label: `#${index + 1}`,
      runId: run.id,
      completedAt: run.completedAt,
      accuracyPercent: run.accuracyPercent,
      meanHitReactionTimeMs: run.meanHitReactionTimeMs,
    }));

  return {
    scoredRuns,
    aggregate,
    latestRun,
    baselineRun,
    completeTrialLogCount: scoredRuns.filter(
      (run) =>
        run.trialCount === CPT_SCORED_TRIALS.length &&
        run.events.length === run.trialCount,
    ).length,
    trendPoints,
    hasTrend: trendPoints.length >= 2,
  };
}
