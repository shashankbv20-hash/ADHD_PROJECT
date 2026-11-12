import type { BackendStroopEvent } from "@/lib/backend/types";

/**
 * Local summary shown right after a run and in demonstration mode. When research consent is granted the
 * server recalculates everything from the trial events using the same definitions.
 *
 * Interference = mean correct reaction time on incongruent trials minus the mean on congruent trials.
 * Only correct answers count towards reaction times; it is withheld if either condition has none.
 */
export interface StroopSummary {
  congruentTrialCount: number;
  incongruentTrialCount: number;
  correctCount: number;
  errorCount: number;
  omissionCount: number;
  accuracyPercent: number | null;
  congruentAccuracyPercent: number | null;
  incongruentAccuracyPercent: number | null;
  meanCongruentReactionTimeMs: number | null;
  meanIncongruentReactionTimeMs: number | null;
  interferenceMs: number | null;
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : null);
const meanOf = (values: number[]) =>
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;

export function summarizeStroop(events: readonly BackendStroopEvent[]): StroopSummary {
  const isCorrect = (event: BackendStroopEvent) => event.responded && event.responseColor === event.ink;
  const congruent = events.filter((event) => event.word === event.ink);
  const incongruent = events.filter((event) => event.word !== event.ink);
  const rts = (group: BackendStroopEvent[]) => group.filter(isCorrect).map((event) => event.reactionTimeMs ?? 0);

  const meanCongruent = meanOf(rts(congruent));
  const meanIncongruent = meanOf(rts(incongruent));

  return {
    congruentTrialCount: congruent.length,
    incongruentTrialCount: incongruent.length,
    correctCount: events.filter(isCorrect).length,
    errorCount: events.filter((event) => event.responded && event.responseColor !== event.ink).length,
    omissionCount: events.filter((event) => !event.responded).length,
    accuracyPercent: pct(events.filter(isCorrect).length, events.length),
    congruentAccuracyPercent: pct(congruent.filter(isCorrect).length, congruent.length),
    incongruentAccuracyPercent: pct(incongruent.filter(isCorrect).length, incongruent.length),
    meanCongruentReactionTimeMs: meanCongruent,
    meanIncongruentReactionTimeMs: meanIncongruent,
    interferenceMs: meanCongruent !== null && meanIncongruent !== null ? meanIncongruent - meanCongruent : null,
  };
}
