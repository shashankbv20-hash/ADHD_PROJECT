import type { BackendStopSignalEvent } from "@/lib/backend/types";

/**
 * Local summary shown immediately after a run (and in demonstration mode). When research consent is
 * granted the server recalculates everything from the trial events; these numbers use the same
 * definitions, so the two agree.
 *
 * SSRT uses the mean method: mean correct go reaction time minus mean stop-signal delay. It is only
 * reported when between 25% and 75% of stops failed (at least 4 stop trials), where it is usable.
 */
export interface StopSignalSummary {
  goTrialCount: number;
  stopTrialCount: number;
  goCorrectCount: number;
  goWrongDirectionCount: number;
  goOmissionCount: number;
  goAccuracyPercent: number | null;
  meanGoReactionTimeMs: number | null;
  successfulStopCount: number;
  failedStopCount: number;
  stopSuccessRatePercent: number | null;
  meanStopSignalDelayMs: number | null;
  ssrtEstimateMs: number | null;
  ssrtReliable: boolean;
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

export function summarizeStopSignal(events: readonly BackendStopSignalEvent[]): StopSignalSummary {
  const go = events.filter((event) => !event.isStop);
  const stops = events.filter((event) => event.isStop);
  const correct = go.filter((event) => event.responded && event.responseDirection === event.stimulus);
  const failed = stops.filter((event) => event.responded);
  const goRts = correct.map((event) => event.reactionTimeMs ?? 0);
  const ssds = stops.map((event) => event.stopSignalDelayMs ?? 0);
  const failedShare = stops.length ? failed.length / stops.length : null;

  const ssrtReliable =
    failedShare !== null && stops.length >= 4 && failedShare >= 0.25 && failedShare <= 0.75 && goRts.length > 0;

  return {
    goTrialCount: go.length,
    stopTrialCount: stops.length,
    goCorrectCount: correct.length,
    goWrongDirectionCount: go.filter((event) => event.responded && event.responseDirection !== event.stimulus).length,
    goOmissionCount: go.filter((event) => !event.responded).length,
    goAccuracyPercent: pct(correct.length, go.length),
    meanGoReactionTimeMs: goRts.length ? Math.round(mean(goRts)) : null,
    successfulStopCount: stops.length - failed.length,
    failedStopCount: failed.length,
    stopSuccessRatePercent: pct(stops.length - failed.length, stops.length),
    meanStopSignalDelayMs: ssds.length ? Math.round(mean(ssds)) : null,
    ssrtEstimateMs: ssrtReliable ? Math.round(mean(goRts) - mean(ssds)) : null,
    ssrtReliable,
  };
}
