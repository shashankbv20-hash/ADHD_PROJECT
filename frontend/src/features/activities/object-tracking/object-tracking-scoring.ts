import { TRACKING_SCORED_TRIALS } from "@/features/activities/object-tracking/object-tracking-config";
import type { BackendObjectTrackingEvent } from "@/lib/backend/types";

/**
 * Local summary shown right after a run and in demonstration mode. When research consent is granted the
 * server holds the target circles and recalculates everything using the same definitions.
 *
 * A trial is perfect when exactly the target circles were picked. "Targets found" counts target circles
 * picked out of all target circles shown. Highest perfect load = most targets tracked in a perfect trial.
 */
export interface ObjectTrackingSummary {
  trialCount: number;
  perfectCount: number;
  perfectPercent: number | null;
  targetsFoundPercent: number | null;
  wrongPickCount: number;
  highestPerfectLoad: number | null;
  byLoad: { targetCount: number; trialCount: number; targetsFoundPercent: number | null }[];
  meanResponseTimeMs: number | null;
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

export function summarizeObjectTracking(
  events: readonly BackendObjectTrackingEvent[],
  trials: readonly { targets: number[] }[] = TRACKING_SCORED_TRIALS,
): ObjectTrackingSummary {
  const rows = events.map((event) => {
    const targets = trials[event.trialIndex]?.targets ?? [];
    const hits = event.selected.filter((cell) => targets.includes(cell)).length;
    return {
      load: event.targetCount,
      hits,
      wrong: event.selected.length - hits,
      perfect: hits === targets.length && event.selected.length === targets.length,
      time: event.responseTimeMs,
    };
  });
  const perfect = rows.filter((row) => row.perfect);
  const times = rows.flatMap((row) => (row.time === null ? [] : [row.time]));

  return {
    trialCount: events.length,
    perfectCount: perfect.length,
    perfectPercent: pct(perfect.length, events.length),
    targetsFoundPercent: pct(
      rows.reduce((sum, row) => sum + row.hits, 0),
      rows.reduce((sum, row) => sum + row.load, 0),
    ),
    wrongPickCount: rows.reduce((sum, row) => sum + row.wrong, 0),
    highestPerfectLoad: perfect.length ? Math.max(...perfect.map((row) => row.load)) : null,
    byLoad: [...new Set(rows.map((row) => row.load))]
      .sort((a, b) => a - b)
      .map((load) => {
        const group = rows.filter((row) => row.load === load);
        return {
          targetCount: load,
          trialCount: group.length,
          targetsFoundPercent: pct(
            group.reduce((sum, row) => sum + row.hits, 0),
            load * group.length,
          ),
        };
      }),
    meanResponseTimeMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
  };
}
