import type { BackendActivitySummary } from "@/lib/backend/types";
import type { CptRunSummary } from "@/types";

/**
 * Maps a server-calculated activity summary to the frontend run shape.
 *
 * The trial-event timeline is held by the backend and not returned in summary
 * lists, so `events` is empty; views already treat `events.length === 0` with a
 * positive `trialCount` as a summary-only run.
 */
export function summaryToCptRun(
  summary: BackendActivitySummary,
  participantId: string,
): CptRunSummary {
  const { metrics } = summary;

  return {
    id: summary.sessionActivityId,
    participantId,
    activityId: "cpt",
    mode: "scored",
    completedAt: summary.createdAt,
    events: [],
    isDemo: true,
    trialCount: metrics.trialCount,
    targetCount: metrics.targetCount,
    nonTargetCount: metrics.nonTargetCount,
    responseCount: metrics.responseCount,
    hitCount: metrics.hitCount,
    missCount: metrics.missCount,
    falseAlarmCount: metrics.falseAlarmCount,
    correctRejectionCount: metrics.correctRejectionCount,
    accuracyPercent: metrics.accuracyPercent,
    meanHitReactionTimeMs: metrics.meanHitReactionTimeMs,
    validReactionTimeCount: metrics.validReactionTimeCount,
    hitReactionTimeTotalMs: metrics.hitReactionTimeTotalMs,
  };
}
