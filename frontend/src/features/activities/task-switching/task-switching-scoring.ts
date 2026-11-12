import { correctSide } from "@/features/activities/task-switching/task-switching-config";
import type { BackendTaskSwitchingEvent } from "@/lib/backend/types";

/**
 * Local summary shown right after a run and in demonstration mode. When research consent is granted the
 * server recalculates everything from the trial events using the same definitions.
 *
 * Switch cost = mean correct reaction time on switch trials minus the mean on repeat trials.
 * Only correct answers count towards reaction times; it is withheld if either condition has none.
 */
export interface TaskSwitchingSummary {
  switchTrialCount: number;
  repeatTrialCount: number;
  correctCount: number;
  errorCount: number;
  omissionCount: number;
  accuracyPercent: number | null;
  switchAccuracyPercent: number | null;
  repeatAccuracyPercent: number | null;
  meanSwitchReactionTimeMs: number | null;
  meanRepeatReactionTimeMs: number | null;
  switchCostMs: number | null;
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : null);
const meanOf = (values: number[]) =>
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;

export function summarizeTaskSwitching(events: readonly BackendTaskSwitchingEvent[]): TaskSwitchingSummary {
  const isCorrect = (event: BackendTaskSwitchingEvent) => event.responded && event.responseSide === correctSide(event);
  // Trial type comes from the rule sequence: the first trial is neither, then switch or repeat.
  const withType = (event: BackendTaskSwitchingEvent, index: number, all: readonly BackendTaskSwitchingEvent[]) =>
    index === 0 ? "first" : event.rule !== all[index - 1].rule ? "switch" : "repeat";

  const switchEvents = events.filter((event, index) => withType(event, index, events) === "switch");
  const repeatEvents = events.filter((event, index) => withType(event, index, events) === "repeat");
  const rts = (group: BackendTaskSwitchingEvent[]) => group.filter(isCorrect).map((event) => event.reactionTimeMs ?? 0);

  const meanSwitch = meanOf(rts(switchEvents));
  const meanRepeat = meanOf(rts(repeatEvents));

  return {
    switchTrialCount: switchEvents.length,
    repeatTrialCount: repeatEvents.length,
    correctCount: events.filter(isCorrect).length,
    errorCount: events.filter((event) => event.responded && !isCorrect(event)).length,
    omissionCount: events.filter((event) => !event.responded).length,
    accuracyPercent: pct(events.filter(isCorrect).length, events.length),
    switchAccuracyPercent: pct(switchEvents.filter(isCorrect).length, switchEvents.length),
    repeatAccuracyPercent: pct(repeatEvents.filter(isCorrect).length, repeatEvents.length),
    meanSwitchReactionTimeMs: meanSwitch,
    meanRepeatReactionTimeMs: meanRepeat,
    switchCostMs: meanSwitch !== null && meanRepeat !== null ? meanSwitch - meanRepeat : null,
  };
}
