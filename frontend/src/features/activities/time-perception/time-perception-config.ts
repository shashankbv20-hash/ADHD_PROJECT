/**
 * Time Perception trial list. It must match the backend (backend/app/services/time_perception.py);
 * the server holds the target durations and derives the error from the reproduced time.
 *
 * A circle is shown for the target duration. The child reproduces it by pressing Start, then Stop.
 */
export const TIME_PERCEPTION_ACTIVITY_CODE = "time-perception";
export const START_PAUSE_MS = 900;
export const REPRODUCE_TIME_LIMIT_MS = 20_000;
export const WITHIN_FRACTION = 0.2;

export interface TimeTrial {
  id: string;
  targetMs: number;
}

function toTrials(targets: number[], mode: "practice" | "scored"): TimeTrial[] {
  return targets.map((targetMs, index) => ({
    id: `${TIME_PERCEPTION_ACTIVITY_CODE}-${mode}-${String(index + 1).padStart(2, "0")}`,
    targetMs,
  }));
}

export const TIME_PRACTICE_TRIALS = toTrials([2000], "practice");
export const TIME_SCORED_TRIALS = toTrials([3000, 1500, 4500, 2000, 3500, 1000, 4000, 2500], "scored");
