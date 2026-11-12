/**
 * Stop-Signal trial sequence. It must match the backend's validated sequence
 * (backend/app/services/stop_signal.py); the server rejects a run that differs.
 * Direction "L"/"R" is the arrow; "s" trials get a stop signal after a delay (SSD), "g" trials do not.
 */
export const STOP_SIGNAL_ACTIVITY_CODE = "stop-signal";

export const STOP_SIGNAL_ARROW_DURATION_MS = 1000;
export const STOP_SIGNAL_RESPONSE_WINDOW_MS = 2200;

export const SSD_START_MS = 250;
export const SSD_MIN_MS = 50;
export const SSD_MAX_MS = 1000;
export const SSD_STEP_MS = 50;

export interface StopSignalTrial {
  id: string;
  direction: "L" | "R";
  isStop: boolean;
}

function toTrials(directions: string, types: string, mode: "practice" | "scored"): StopSignalTrial[] {
  return [...directions].map((direction, index) => ({
    id: `${STOP_SIGNAL_ACTIVITY_CODE}-${mode}-${String(index + 1).padStart(2, "0")}`,
    direction: direction as "L" | "R",
    isStop: types[index] === "s",
  }));
}

export const STOP_SIGNAL_PRACTICE_TRIALS = toTrials("LRLRRLRL", "gggsggsg", "practice");
export const STOP_SIGNAL_SCORED_TRIALS = toTrials(
  "LRRLLRLR" + "RLRLRRLL" + "LLRLRLRR" + "RRLRLLRL",
  "gggsggsg" + "ggsgggsg" + "gggsgsgg" + "ggsggsgg",
  "scored",
);

/**
 * Staircase: a successful stop makes the next stop harder (later signal), a failed stop makes it easier.
 * Always a whole number of 50 ms steps inside the range the server accepts.
 */
export function nextStopSignalDelay(current: number, stoppedSuccessfully: boolean): number {
  const next = current + (stoppedSuccessfully ? SSD_STEP_MS : -SSD_STEP_MS);
  return Math.min(SSD_MAX_MS, Math.max(SSD_MIN_MS, next));
}
