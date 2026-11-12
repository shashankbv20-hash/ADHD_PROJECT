import type { CptTrialDefinition } from "@/types";

/**
 * Go/No-Go trial sequences. They must match the backend's validated sequences
 * (backend/app/services/cpt_scoring.py); the server rejects a run that differs.
 * "G" asks for a response, "N" asks the child to hold back.
 */
export const GO_NO_GO_ACTIVITY_CODE = "go-no-go";
export const GO_NO_GO_GO_STIMULUS = "G";

export const GO_NO_GO_STIMULUS_DURATION_MS = 650;
export const GO_NO_GO_RESPONSE_WINDOW_MS = 2200;

const PRACTICE = "GGNGGGNG";
const SCORED = "GGNGGGNG" + "GNGGGNGG" + "GGGNGGNG" + "NGGGNGGG";

function toTrials(sequence: string, mode: "practice" | "scored"): CptTrialDefinition[] {
  return [...sequence].map((stimulus, index) => ({
    id: `${GO_NO_GO_ACTIVITY_CODE}-${mode}-${String(index + 1).padStart(2, "0")}`,
    stimulus,
    isTarget: stimulus === GO_NO_GO_GO_STIMULUS,
  }));
}

export const GO_NO_GO_PRACTICE_TRIALS = toTrials(PRACTICE, "practice");
export const GO_NO_GO_SCORED_TRIALS = toTrials(SCORED, "scored");
