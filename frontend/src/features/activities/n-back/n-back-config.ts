import type { CptTrialDefinition } from "@/types";

/**
 * N-back sequences. They must match the backend's validated sequences
 * (backend/app/services/cpt_scoring.py); the server derives every trial's target status from the
 * letters and rejects a run that disagrees.
 *
 * Practice is 1-back only. A scored run is 16 trials of 1-back followed by 16 trials of 2-back. Matching
 * restarts at each level, so the first N trials of a level can never be targets.
 */
export const N_BACK_ACTIVITY_CODE = "n-back";

export const N_BACK_LETTER_DURATION_MS = 1000;
export const N_BACK_RESPONSE_WINDOW_MS = 2200;
export const N_BACK_LEVEL_LENGTH = 16;

const PRACTICE = "ABBCDDAC";
const SCORED = "KKMLLQKMMQFFKLQK" + "LQLMKMFQFKLKQDMQ";

export function nBackLevel(mode: "practice" | "scored", trialIndex: number): 1 | 2 {
  return mode === "practice" || trialIndex < N_BACK_LEVEL_LENGTH ? 1 : 2;
}

function toTrials(sequence: string, mode: "practice" | "scored"): CptTrialDefinition[] {
  return [...sequence].map((stimulus, index) => {
    const n = nBackLevel(mode, index);
    const levelStart = n === 1 ? 0 : N_BACK_LEVEL_LENGTH;
    return {
      id: `${N_BACK_ACTIVITY_CODE}-${mode}-${String(index + 1).padStart(2, "0")}`,
      stimulus,
      isTarget: index - levelStart >= n && stimulus === sequence[index - n],
    };
  });
}

export const N_BACK_PRACTICE_TRIALS = toTrials(PRACTICE, "practice");
export const N_BACK_SCORED_TRIALS = toTrials(SCORED, "scored");
