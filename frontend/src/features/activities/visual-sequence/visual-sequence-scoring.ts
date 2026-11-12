import { VISUAL_SEQUENCE_SCORED_TRIALS } from "@/features/activities/visual-sequence/visual-sequence-config";
import type { BackendVisualSequenceEvent } from "@/lib/backend/types";

/**
 * Local summary shown right after a run and in demonstration mode. When research consent is granted the
 * server holds the sequences and recalculates everything using the same definitions.
 *
 * Longest correct span = length of the longest sequence tapped back exactly right.
 * Correct positions = taps that matched the sequence at the same position, out of all items shown.
 */
export interface VisualSequenceSummary {
  trialCount: number;
  correctCount: number;
  accuracyPercent: number | null;
  longestCorrectSpan: number | null;
  correctPositionPercent: number | null;
  noResponseCount: number;
  meanFirstResponseMs: number | null;
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

export function summarizeVisualSequence(
  events: readonly BackendVisualSequenceEvent[],
  trials: readonly { sequence: number[] }[] = VISUAL_SEQUENCE_SCORED_TRIALS,
): VisualSequenceSummary {
  const rows = events.map((event) => {
    const sequence = trials[event.trialIndex]?.sequence ?? [];
    return {
      event,
      length: sequence.length,
      matched: event.response.filter((cell, i) => cell === sequence[i]).length,
      correct: event.response.length === sequence.length && event.response.every((cell, i) => cell === sequence[i]),
    };
  });
  const correct = rows.filter((row) => row.correct);
  const latencies = events.flatMap((event) => (event.firstResponseLatencyMs === null ? [] : [event.firstResponseLatencyMs]));

  return {
    trialCount: events.length,
    correctCount: correct.length,
    accuracyPercent: pct(correct.length, events.length),
    longestCorrectSpan: correct.length ? Math.max(...correct.map((row) => row.length)) : null,
    correctPositionPercent: pct(
      rows.reduce((sum, row) => sum + row.matched, 0),
      rows.reduce((sum, row) => sum + row.length, 0),
    ),
    noResponseCount: events.filter((event) => event.response.length === 0).length,
    meanFirstResponseMs: latencies.length
      ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
      : null,
  };
}
