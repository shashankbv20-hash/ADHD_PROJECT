import type {
  BackendActivitySummary,
  BackendCptMetrics,
  BackendStopSignalMetrics,
  BackendStroopMetrics,
  BackendTaskSwitchingMetrics,
  BackendVisualSearchMetrics,
  BackendPlanningPuzzleMetrics,
  BackendVisualSequenceMetrics,
  BackendTimePerceptionMetrics,
  BackendObjectTrackingMetrics,
} from "@/lib/backend/types";
import type { CptRunSummary } from "@/types";

/** A saved Go/No-Go run as shown in history. All values are server-calculated. */
export interface GoNoGoRunView {
  id: string;
  completedAt: string;
  accuracyPercent: number | null;
  correctGo: number;
  omissions: number;
  commissions: number;
  correctHoldBack: number;
  meanGoReactionTimeMs: number | null;
}

export function summaryToGoNoGoRun(summary: BackendActivitySummary): GoNoGoRunView {
  const metrics = cptMetricsOf(summary);

  return {
    id: summary.sessionActivityId,
    completedAt: summary.createdAt,
    accuracyPercent: metrics.accuracyPercent,
    correctGo: metrics.hitCount,
    omissions: metrics.omissionErrorCount,
    commissions: metrics.commissionErrorCount,
    correctHoldBack: metrics.correctRejectionCount,
    meanGoReactionTimeMs: metrics.meanHitReactionTimeMs,
  };
}

/**
 * Maps a server-calculated activity summary to the frontend run shape.
 *
 * The trial-event timeline is held by the backend and not returned in summary
 * lists, so `events` is empty; views already treat `events.length === 0` with a
 * positive `trialCount` as a summary-only run.
 */
function cptMetricsOf(summary: BackendActivitySummary): BackendCptMetrics {
  if (!("hitCount" in summary.metrics)) {
    throw new Error("This summary is not a CPT-style summary.");
  }
  return summary.metrics;
}

export function summaryToCptRun(
  summary: BackendActivitySummary,
  participantId: string,
): CptRunSummary {
  const metrics = cptMetricsOf(summary);

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

/** A saved N-back run as shown in history. Level accuracy comes from the server's block metrics. */
export interface NBackRunView {
  id: string;
  completedAt: string;
  accuracyPercent: number | null;
  hits: number;
  misses: number;
  falseAlarms: number;
  oneBackAccuracyPercent: number | null;
  twoBackAccuracyPercent: number | null;
}

/** Blocks are 8 trials: blocks 1-2 are 1-back, blocks 3-4 are 2-back. */
function levelAccuracy(blocks: { block: number; accuracyPercent: number }[], wanted: number[]): number | null {
  const chosen = blocks.filter((block) => wanted.includes(block.block));
  return chosen.length === wanted.length
    ? Math.round(chosen.reduce((sum, block) => sum + block.accuracyPercent, 0) / chosen.length)
    : null;
}

export function summaryToNBackRun(summary: BackendActivitySummary): NBackRunView {
  const metrics = cptMetricsOf(summary);

  return {
    id: summary.sessionActivityId,
    completedAt: summary.createdAt,
    accuracyPercent: metrics.accuracyPercent,
    hits: metrics.hitCount,
    misses: metrics.missCount,
    falseAlarms: metrics.falseAlarmCount,
    oneBackAccuracyPercent: levelAccuracy(metrics.blockMetrics, [1, 2]),
    twoBackAccuracyPercent: levelAccuracy(metrics.blockMetrics, [3, 4]),
  };
}

/** A saved Stop-Signal run as shown in history. All values are server-calculated. */
export interface StopSignalRunView {
  id: string;
  completedAt: string;
  goAccuracyPercent: number | null;
  meanGoReactionTimeMs: number | null;
  stopSuccessRatePercent: number | null;
  meanStopSignalDelayMs: number | null;
  ssrtEstimateMs: number | null;
  ssrtReliable: boolean;
}

export function summaryToStopSignalRun(summary: BackendActivitySummary): StopSignalRunView {
  const metrics = summary.metrics as BackendStopSignalMetrics;

  return {
    id: summary.sessionActivityId,
    completedAt: summary.createdAt,
    goAccuracyPercent: metrics.goAccuracyPercent,
    meanGoReactionTimeMs: metrics.meanGoReactionTimeMs,
    stopSuccessRatePercent: metrics.stopSuccessRatePercent,
    meanStopSignalDelayMs: metrics.meanStopSignalDelayMs,
    ssrtEstimateMs: metrics.ssrtEstimateMs,
    ssrtReliable: metrics.ssrtReliable,
  };
}

/** A saved Stroop run as shown in history. All values are server-calculated. */
export interface StroopRunView {
  id: string;
  completedAt: string;
  accuracyPercent: number | null;
  congruentAccuracyPercent: number | null;
  incongruentAccuracyPercent: number | null;
  interferenceMs: number | null;
  errors: number;
  omissions: number;
}

export function summaryToStroopRun(summary: BackendActivitySummary): StroopRunView {
  const metrics = summary.metrics as BackendStroopMetrics;

  return {
    id: summary.sessionActivityId,
    completedAt: summary.createdAt,
    accuracyPercent: metrics.accuracyPercent,
    congruentAccuracyPercent: metrics.congruentAccuracyPercent,
    incongruentAccuracyPercent: metrics.incongruentAccuracyPercent,
    interferenceMs: metrics.interferenceMs,
    errors: metrics.errorCount,
    omissions: metrics.omissionCount,
  };
}

/** A saved Task Switching run as shown in history. All values are server-calculated. */
export interface TaskSwitchingRunView {
  id: string;
  completedAt: string;
  accuracyPercent: number | null;
  repeatAccuracyPercent: number | null;
  switchAccuracyPercent: number | null;
  switchCostMs: number | null;
  errors: number;
  omissions: number;
}

export function summaryToTaskSwitchingRun(summary: BackendActivitySummary): TaskSwitchingRunView {
  const metrics = summary.metrics as BackendTaskSwitchingMetrics;

  return {
    id: summary.sessionActivityId,
    completedAt: summary.createdAt,
    accuracyPercent: metrics.accuracyPercent,
    repeatAccuracyPercent: metrics.repeatAccuracyPercent,
    switchAccuracyPercent: metrics.switchAccuracyPercent,
    switchCostMs: metrics.switchCostMs,
    errors: metrics.errorCount,
    omissions: metrics.omissionCount,
  };
}

/** A saved Visual Search run as shown in history. All values are server-calculated. */
export interface VisualSearchRunView {
  id: string;
  completedAt: string;
  accuracyPercent: number | null;
  meanReactionTimeMs: number | null;
  searchSlopeMsPerItem: number | null;
  errors: number;
  omissions: number;
}

export function summaryToVisualSearchRun(summary: BackendActivitySummary): VisualSearchRunView {
  const metrics = summary.metrics as BackendVisualSearchMetrics;

  return {
    id: summary.sessionActivityId,
    completedAt: summary.createdAt,
    accuracyPercent: metrics.accuracyPercent,
    meanReactionTimeMs: metrics.meanReactionTimeMs,
    searchSlopeMsPerItem: metrics.searchSlopeMsPerItem,
    errors: metrics.errorCount,
    omissions: metrics.omissionCount,
  };
}

/** A saved Planning Puzzle run as shown in history. All values are server-calculated. */
export interface PlanningPuzzleRunView {
  id: string;
  completedAt: string;
  puzzleCount: number;
  solvedCount: number;
  meanExtraMoves: number | null;
  meanPlanningTimeMs: number | null;
  illegalAttempts: number;
}

export function summaryToPlanningPuzzleRun(summary: BackendActivitySummary): PlanningPuzzleRunView {
  const metrics = summary.metrics as BackendPlanningPuzzleMetrics;

  return {
    id: summary.sessionActivityId,
    completedAt: summary.createdAt,
    puzzleCount: metrics.puzzleCount,
    solvedCount: metrics.solvedCount,
    meanExtraMoves: metrics.meanExtraMoves,
    meanPlanningTimeMs: metrics.meanPlanningTimeMs,
    illegalAttempts: metrics.illegalAttempts,
  };
}

/** A saved Visual Sequence run as shown in history. All values are server-calculated. */
export interface VisualSequenceRunView {
  id: string;
  completedAt: string;
  trialCount: number;
  correctCount: number;
  longestCorrectSpan: number | null;
  correctPositionPercent: number | null;
}

export function summaryToVisualSequenceRun(summary: BackendActivitySummary): VisualSequenceRunView {
  const metrics = summary.metrics as BackendVisualSequenceMetrics;

  return {
    id: summary.sessionActivityId,
    completedAt: summary.createdAt,
    trialCount: metrics.trialCount,
    correctCount: metrics.correctCount,
    longestCorrectSpan: metrics.longestCorrectSpan,
    correctPositionPercent: metrics.correctPositionPercent,
  };
}

/** A saved Time Perception run as shown in history. All values are server-calculated. */
export interface TimePerceptionRunView {
  id: string;
  completedAt: string;
  trialCount: number;
  withinToleranceCount: number;
  meanAbsoluteErrorMs: number | null;
  meanSignedErrorMs: number | null;
  meanRatio: number | null;
}

export function summaryToTimePerceptionRun(summary: BackendActivitySummary): TimePerceptionRunView {
  const metrics = summary.metrics as BackendTimePerceptionMetrics;

  return {
    id: summary.sessionActivityId,
    completedAt: summary.createdAt,
    trialCount: metrics.trialCount,
    withinToleranceCount: metrics.withinToleranceCount,
    meanAbsoluteErrorMs: metrics.meanAbsoluteErrorMs,
    meanSignedErrorMs: metrics.meanSignedErrorMs,
    meanRatio: metrics.meanRatio,
  };
}

/** A saved Multiple Object Tracking run as shown in history. All values are server-calculated. */
export interface ObjectTrackingRunView {
  id: string;
  completedAt: string;
  trialCount: number;
  perfectCount: number;
  targetsFoundPercent: number | null;
  highestPerfectLoad: number | null;
}

export function summaryToObjectTrackingRun(summary: BackendActivitySummary): ObjectTrackingRunView {
  const metrics = summary.metrics as BackendObjectTrackingMetrics;

  return {
    id: summary.sessionActivityId,
    completedAt: summary.createdAt,
    trialCount: metrics.trialCount,
    perfectCount: metrics.perfectCount,
    targetsFoundPercent: metrics.targetsFoundPercent,
    highestPerfectLoad: metrics.highestPerfectLoad,
  };
}
