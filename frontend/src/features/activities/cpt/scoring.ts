import type {
  CptMetrics,
  CptRunSummary,
  CptTrialDefinition,
  CptTrialEvent,
  CptTrialOutcome,
} from "@/types";

export interface CptResponseInput {
  responded: boolean;
  reactionTimeMs: number | null;
}

export function createCptTrialEvent(
  trial: CptTrialDefinition,
  trialIndex: number,
  response: CptResponseInput,
): CptTrialEvent {
  const reactionTimeMs =
    response.responded &&
    typeof response.reactionTimeMs === "number" &&
    Number.isFinite(response.reactionTimeMs) &&
    response.reactionTimeMs >= 0
      ? Math.round(response.reactionTimeMs)
      : null;

  let outcome: CptTrialOutcome;

  if (trial.isTarget) {
    outcome = response.responded ? "hit" : "miss";
  } else {
    outcome = response.responded ? "false-alarm" : "correct-rejection";
  }

  return {
    trialIndex,
    trialId: trial.id,
    stimulus: trial.stimulus,
    isTarget: trial.isTarget,
    responded: response.responded,
    reactionTimeMs,
    outcome,
  };
}

export function calculateCptMetrics(
  events: readonly CptTrialEvent[],
): CptMetrics {
  const trialCount = events.length;
  const targetCount = events.filter((event) => event.isTarget).length;
  const nonTargetCount = trialCount - targetCount;
  const responseCount = events.filter((event) => event.responded).length;
  const hitCount = events.filter((event) => event.outcome === "hit").length;
  const missCount = events.filter((event) => event.outcome === "miss").length;
  const falseAlarmCount = events.filter(
    (event) => event.outcome === "false-alarm",
  ).length;
  const correctRejectionCount = events.filter(
    (event) => event.outcome === "correct-rejection",
  ).length;

  const hitReactionTimes = events
    .filter(
      (event) =>
        event.outcome === "hit" && event.reactionTimeMs !== null,
    )
    .map((event) => event.reactionTimeMs as number);

  const meanHitReactionTimeMs =
    hitReactionTimes.length > 0
      ? Math.round(
          hitReactionTimes.reduce((total, value) => total + value, 0) /
            hitReactionTimes.length,
        )
      : null;

  const accuracyPercent =
    trialCount > 0
      ? Math.round(
          ((hitCount + correctRejectionCount) / trialCount) * 100,
        )
      : null;

  return {
    trialCount,
    targetCount,
    nonTargetCount,
    responseCount,
    hitCount,
    missCount,
    falseAlarmCount,
    correctRejectionCount,
    accuracyPercent,
    meanHitReactionTimeMs,
    validReactionTimeCount: hitReactionTimes.length,
    hitReactionTimeTotalMs: hitReactionTimes.reduce((total, value) => total + value, 0),
  };
}

/** Aggregates per-run summaries when trial-level events were not retained. */
export function aggregateCptMetrics(
  summaries: readonly CptMetrics[],
): CptMetrics {
  const sum = (select: (summary: CptMetrics) => number) =>
    summaries.reduce((total, summary) => total + select(summary), 0);
  const trialCount = sum((summary) => summary.trialCount);
  const targetCount = sum((summary) => summary.targetCount);
  const nonTargetCount = sum((summary) => summary.nonTargetCount);
  const responseCount = sum((summary) => summary.responseCount);
  const hitCount = sum((summary) => summary.hitCount);
  const missCount = sum((summary) => summary.missCount);
  const falseAlarmCount = sum((summary) => summary.falseAlarmCount);
  const correctRejectionCount = sum(
    (summary) => summary.correctRejectionCount,
  );
  const validReactionTimeCount = sum(
    (summary) => summary.validReactionTimeCount,
  );
  const weightedReactionTime = summaries.reduce(
    (total, summary) =>
      total +
      (summary.hitReactionTimeTotalMs ??
        (summary.meanHitReactionTimeMs ?? 0) * summary.validReactionTimeCount),
    0,
  );

  return {
    trialCount,
    targetCount,
    nonTargetCount,
    responseCount,
    hitCount,
    missCount,
    falseAlarmCount,
    correctRejectionCount,
    accuracyPercent:
      trialCount > 0
        ? Math.round(((hitCount + correctRejectionCount) / trialCount) * 100)
        : null,
    meanHitReactionTimeMs:
      validReactionTimeCount > 0
        ? Math.round(weightedReactionTime / validReactionTimeCount)
        : null,
    validReactionTimeCount,
    hitReactionTimeTotalMs: weightedReactionTime,
  };
}

export function buildCptRunSummary(input: {
  id: string;
  participantId: string;
  mode: "practice" | "scored";
  completedAt: string;
  events: CptTrialEvent[];
}): CptRunSummary {
  return {
    id: input.id,
    participantId: input.participantId,
    activityId: "cpt",
    mode: input.mode,
    completedAt: input.completedAt,
    events: input.events,
    isDemo: true,
    ...calculateCptMetrics(input.events),
  };
}
