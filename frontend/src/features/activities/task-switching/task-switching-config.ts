import type { TaskSwitchingColour, TaskSwitchingRule, TaskSwitchingShape } from "@/lib/backend/types";

/**
 * Task Switching trial list. It must match the backend's validated list
 * (backend/app/services/task_switching.py); the server derives the correct side and which trials are
 * switches from the rule sequence and rejects a run that differs.
 *
 * Rule: colour or shape. Left key = red / circle, right key = blue / square.
 * A trial is a "switch" when its rule differs from the previous trial; the first trial is neither.
 */
export const TASK_SWITCHING_ACTIVITY_CODE = "task-switching";
export const TASK_SWITCHING_RESPONSE_WINDOW_MS = 2200;

export const TASK_SWITCHING_KEYS: Record<string, "L" | "R"> = {
  ArrowLeft: "L",
  ArrowRight: "R",
  f: "L",
  j: "R",
};

export const RULE_LABELS: Record<TaskSwitchingRule, { title: string; left: string; right: string }> = {
  colour: { title: "COLOUR", left: "Red", right: "Blue" },
  shape: { title: "SHAPE", left: "Circle", right: "Square" },
};

export interface TaskSwitchingTrial {
  id: string;
  rule: TaskSwitchingRule;
  colour: TaskSwitchingColour;
  shape: TaskSwitchingShape;
  type: "first" | "switch" | "repeat";
}

function toTrials(rules: string, colours: string, shapes: string, mode: "practice" | "scored"): TaskSwitchingTrial[] {
  return [...rules].map((rule, index) => ({
    id: `${TASK_SWITCHING_ACTIVITY_CODE}-${mode}-${String(index + 1).padStart(2, "0")}`,
    rule: rule === "C" ? "colour" : "shape",
    colour: colours[index] as TaskSwitchingColour,
    shape: shapes[index] as TaskSwitchingShape,
    type: index === 0 ? "first" : rule !== rules[index - 1] ? "switch" : "repeat",
  }));
}

// Rule: C = colour, S = shape. Colour: R red, B blue. Shape: O circle, Q square.
export const TASK_SWITCHING_PRACTICE_TRIALS = toTrials("CCSSCCSS", "RBRBBBRR", "QOOOQQOQ", "practice");
export const TASK_SWITCHING_SCORED_TRIALS = toTrials(
  "CCSSCCSSCCSSSCCCSCSCSSCSSCCSSCCC",
  "BBRRRRBRRRBBBBRBBBRRBBBBRRRRRRBB",
  "OQQQQQOOOOQQOQOQOQQQOOQQQOOOQOOO",
  "scored",
);

export function correctSide(trial: Pick<TaskSwitchingTrial, "rule" | "colour" | "shape">): "L" | "R" {
  if (trial.rule === "colour") return trial.colour === "R" ? "L" : "R";
  return trial.shape === "O" ? "L" : "R";
}
