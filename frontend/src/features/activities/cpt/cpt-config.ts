import type { CptTrialDefinition } from "@/types";

export const CPT_TARGET_STIMULUS = "X";

export const CPT_STIMULUS_DURATION_MS = 650;
export const CPT_RESPONSE_WINDOW_MS = 1200;

export const CPT_PRACTICE_STIMULI = [
  "A",
  "X",
  "B",
  "C",
  "X",
  "D",
] as const;

export const CPT_SCORED_STIMULI = [
  "A",
  "X",
  "B",
  "C",
  "D",
  "X",
  "B",
  "A",
  "X",
  "C",
  "D",
  "B",
  "X",
  "A",
  "C",
  "D",
  "X",
  "B",
  "A",
  "C",
  "D",
  "X",
  "B",
  "A",
] as const;

export function getCptTrialDefinitions(
  stimuli: readonly string[],
  prefix: string,
): CptTrialDefinition[] {
  return stimuli.map((stimulus, index) => ({
    id: `${prefix}-${String(index + 1).padStart(2, "0")}`,
    stimulus,
    isTarget: stimulus === CPT_TARGET_STIMULUS,
  }));
}

export const CPT_PRACTICE_TRIALS = getCptTrialDefinitions(
  CPT_PRACTICE_STIMULI,
  "cpt-practice",
);

export const CPT_SCORED_TRIALS = getCptTrialDefinitions(
  CPT_SCORED_STIMULI,
  "cpt-scored",
);
