import {
  buildCptProgressSummary,
  type CptProgressSummary,
} from "@/features/activities/cpt/cpt-progress-data";
import type { CptRunSummary } from "@/types";

export interface DigitalTwinBaselineComparison {
  accuracyDelta: number | null;
  reactionTimeDelta: number | null;
}

export interface DigitalTwinProfileData extends CptProgressSummary {
  baselineComparison: DigitalTwinBaselineComparison | null;
  consistentTrialCount: boolean;
  observationWindow: { start: string; end: string } | null;
}

export function buildDigitalTwinProfile(
  runs: readonly CptRunSummary[],
): DigitalTwinProfileData {
  const progress = buildCptProgressSummary(runs);
  const { scoredRuns, latestRun, baselineRun } = progress;

  const baselineComparison =
    scoredRuns.length >= 2 && latestRun && baselineRun
      ? {
          accuracyDelta:
            latestRun.accuracyPercent !== null &&
            baselineRun.accuracyPercent !== null
              ? latestRun.accuracyPercent - baselineRun.accuracyPercent
              : null,
          reactionTimeDelta:
            latestRun.meanHitReactionTimeMs !== null &&
            baselineRun.meanHitReactionTimeMs !== null
              ? latestRun.meanHitReactionTimeMs -
                baselineRun.meanHitReactionTimeMs
              : null,
        }
      : null;

  return {
    ...progress,
    baselineComparison,
    consistentTrialCount:
      scoredRuns.length === 0 ||
      new Set(scoredRuns.map((run) => run.trialCount)).size === 1,
    observationWindow:
      latestRun && baselineRun
        ? {
            start: baselineRun.completedAt,
            end: latestRun.completedAt,
          }
        : null,
  };
}
