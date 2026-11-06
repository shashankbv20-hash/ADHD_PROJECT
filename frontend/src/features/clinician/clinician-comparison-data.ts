import type { CptRunSummary } from "@/types";

export type CptComparisonUnit = "count" | "percent" | "milliseconds";

export interface CptComparisonMeasure {
  id: string;
  label: string;
  unit: CptComparisonUnit;
  sessionA: number | null;
  sessionB: number | null;
  difference: number | null;
}

export function isEligibleCptRun(run: CptRunSummary): boolean {
  return (
    run.activityId === "cpt" &&
    run.mode === "scored" &&
    run.id.trim().length > 0 &&
    run.participantId.trim().length > 0 &&
    run.trialCount > 0 &&
    run.events.length === run.trialCount &&
    run.accuracyPercent !== null
  );
}

export function getEligibleCptRuns(
  runs: readonly CptRunSummary[],
): CptRunSummary[] {
  return runs.filter(isEligibleCptRun);
}

export function getComparableParticipantIds(
  runs: readonly CptRunSummary[],
): string[] {
  const counts = new Map<string, number>();

  for (const run of getEligibleCptRuns(runs)) {
    counts.set(run.participantId, (counts.get(run.participantId) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([participantId]) => participantId);
}

export function canCompareCptRuns(
  sessionA: CptRunSummary,
  sessionB: CptRunSummary,
): boolean {
  return (
    isEligibleCptRun(sessionA) &&
    isEligibleCptRun(sessionB) &&
    sessionA.participantId === sessionB.participantId &&
    sessionA.id !== sessionB.id
  );
}

function createMeasure({
  id,
  label,
  unit,
  sessionA,
  sessionB,
}: {
  id: string;
  label: string;
  unit: CptComparisonUnit;
  sessionA: number | null;
  sessionB: number | null;
}): CptComparisonMeasure {
  return {
    id,
    label,
    unit,
    sessionA,
    sessionB,
    difference:
      sessionA !== null && sessionB !== null ? sessionB - sessionA : null,
  };
}

export function buildCptComparisonMeasures(
  sessionA: CptRunSummary,
  sessionB: CptRunSummary,
): CptComparisonMeasure[] {
  return [
    createMeasure({
      id: "trial-count",
      label: "Scored trials",
      unit: "count",
      sessionA: sessionA.trialCount,
      sessionB: sessionB.trialCount,
    }),
    createMeasure({
      id: "target-count",
      label: "Target trials",
      unit: "count",
      sessionA: sessionA.targetCount,
      sessionB: sessionB.targetCount,
    }),
    createMeasure({
      id: "hit-count",
      label: "Correct detections",
      unit: "count",
      sessionA: sessionA.hitCount,
      sessionB: sessionB.hitCount,
    }),
    createMeasure({
      id: "miss-count",
      label: "Missed targets",
      unit: "count",
      sessionA: sessionA.missCount,
      sessionB: sessionB.missCount,
    }),
    createMeasure({
      id: "false-alarm-count",
      label: "Incorrect responses",
      unit: "count",
      sessionA: sessionA.falseAlarmCount,
      sessionB: sessionB.falseAlarmCount,
    }),
    createMeasure({
      id: "correct-rejection-count",
      label: "Correct rejections",
      unit: "count",
      sessionA: sessionA.correctRejectionCount,
      sessionB: sessionB.correctRejectionCount,
    }),
    createMeasure({
      id: "response-count",
      label: "Recorded responses",
      unit: "count",
      sessionA: sessionA.responseCount,
      sessionB: sessionB.responseCount,
    }),
    createMeasure({
      id: "accuracy",
      label: "Accuracy",
      unit: "percent",
      sessionA: sessionA.accuracyPercent,
      sessionB: sessionB.accuracyPercent,
    }),
    createMeasure({
      id: "mean-hit-reaction-time",
      label: "Mean hit reaction time",
      unit: "milliseconds",
      sessionA: sessionA.meanHitReactionTimeMs,
      sessionB: sessionB.meanHitReactionTimeMs,
    }),
    createMeasure({
      id: "valid-reaction-time-count",
      label: "Valid reaction times",
      unit: "count",
      sessionA: sessionA.validReactionTimeCount,
      sessionB: sessionB.validReactionTimeCount,
    }),
  ];
}
