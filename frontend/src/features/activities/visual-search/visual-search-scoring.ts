import type { BackendVisualSearchEvent } from "@/lib/backend/types";

/**
 * Local summary shown right after a run and in demonstration mode. When research consent is granted the
 * server recalculates everything from the trial events using the same definitions.
 *
 * Search slope = least-squares slope of reaction time on grid size, fitted over correct target-present
 * trials only (absent trials take longer by design). Withheld unless two grid sizes have correct trials.
 */
export interface VisualSearchSummary {
  targetPresentCount: number;
  targetAbsentCount: number;
  correctCount: number;
  errorCount: number;
  omissionCount: number;
  accuracyPercent: number | null;
  presentAccuracyPercent: number | null;
  absentAccuracyPercent: number | null;
  meanReactionTimeMs: number | null;
  bySetSize: { setSize: number; meanReactionTimeMs: number | null }[];
  searchSlopeMsPerItem: number | null;
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : null);
const meanOf = (values: number[]) =>
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;

export function summarizeVisualSearch(events: readonly BackendVisualSearchEvent[]): VisualSearchSummary {
  const isCorrect = (event: BackendVisualSearchEvent) =>
    event.responded && (event.response === "present") === event.targetPresent;
  const present = events.filter((event) => event.targetPresent);
  const absent = events.filter((event) => !event.targetPresent);
  const correct = events.filter(isCorrect);

  const points = present.filter(isCorrect).map((event) => [event.setSize, event.reactionTimeMs ?? 0] as const);
  let slope: number | null = null;
  if (new Set(points.map(([size]) => size)).size >= 2) {
    const mx = points.reduce((sum, [size]) => sum + size, 0) / points.length;
    const my = points.reduce((sum, [, rt]) => sum + rt, 0) / points.length;
    const numerator = points.reduce((sum, [size, rt]) => sum + (size - mx) * (rt - my), 0);
    const denominator = points.reduce((sum, [size]) => sum + (size - mx) ** 2, 0);
    slope = Math.round((numerator / denominator) * 10) / 10;
  }

  return {
    targetPresentCount: present.length,
    targetAbsentCount: absent.length,
    correctCount: correct.length,
    errorCount: events.filter((event) => event.responded && !isCorrect(event)).length,
    omissionCount: events.filter((event) => !event.responded).length,
    accuracyPercent: pct(correct.length, events.length),
    presentAccuracyPercent: pct(present.filter(isCorrect).length, present.length),
    absentAccuracyPercent: pct(absent.filter(isCorrect).length, absent.length),
    meanReactionTimeMs: meanOf(correct.map((event) => event.reactionTimeMs ?? 0)),
    bySetSize: [4, 8, 12].map((setSize) => ({
      setSize,
      meanReactionTimeMs: meanOf(
        correct.filter((event) => event.setSize === setSize).map((event) => event.reactionTimeMs ?? 0),
      ),
    })),
    searchSlopeMsPerItem: slope,
  };
}
