import { WITHIN_FRACTION } from "@/features/activities/time-perception/time-perception-config";
import type { BackendTimePerceptionEvent } from "@/lib/backend/types";

/**
 * Local summary shown right after a run and in demonstration mode. When research consent is granted the
 * server holds the target durations and recalculates everything using the same definitions.
 *
 * Error = reproduced minus target (positive = held too long). Ratio = reproduced / target.
 * "Close" = within 20% of the target. Trials with no answer count against the close percentage.
 */
export interface TimePerceptionSummary {
  trialCount: number;
  responseCount: number;
  noResponseCount: number;
  meanAbsoluteErrorMs: number | null;
  meanSignedErrorMs: number | null;
  meanRatio: number | null;
  ratioVariability: number | null;
  withinToleranceCount: number;
  withinTolerancePercent: number;
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

export function summarizeTimePerception(events: readonly BackendTimePerceptionEvent[]): TimePerceptionSummary {
  const answered = events.filter((event) => event.reproducedMs !== null) as (BackendTimePerceptionEvent & {
    reproducedMs: number;
  })[];
  const errors = answered.map((event) => event.reproducedMs - event.targetMs);
  const ratios = answered.map((event) => Math.round((event.reproducedMs / event.targetMs) * 1000) / 1000);
  const within = answered.filter(
    (event) => Math.abs(event.reproducedMs - event.targetMs) <= WITHIN_FRACTION * event.targetMs,
  ).length;
  const spread = ratios.length >= 2 ? Math.sqrt(mean(ratios.map((r) => (r - mean(ratios)) ** 2))) : null;

  return {
    trialCount: events.length,
    responseCount: answered.length,
    noResponseCount: events.length - answered.length,
    meanAbsoluteErrorMs: errors.length ? Math.round(mean(errors.map(Math.abs))) : null,
    meanSignedErrorMs: errors.length ? Math.round(mean(errors)) : null,
    meanRatio: ratios.length ? Math.round(mean(ratios) * 100) / 100 : null,
    ratioVariability: spread === null ? null : Math.round(spread * 100) / 100,
    withinToleranceCount: within,
    withinTolerancePercent: events.length ? Math.round((within / events.length) * 1000) / 10 : 0,
  };
}
