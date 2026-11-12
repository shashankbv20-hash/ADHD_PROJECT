/**
 * Visual Sequence Memory trial list. It must match the backend (backend/app/services/visual_sequence.py);
 * the server holds the sequences and decides whether each answer was exactly right.
 *
 * A 3x3 grid, cells numbered 0-8 (left to right, top to bottom). Cells light up one at a time and the
 * child taps them back in the same order.
 */
export const VISUAL_SEQUENCE_ACTIVITY_CODE = "visual-sequence";

export const CELL_LIGHT_MS = 600;
export const CELL_GAP_MS = 250;
export const START_PAUSE_MS = 800;
export const RECALL_TIME_LIMIT_MS = 15_000;

export interface SequenceTrial {
  id: string;
  sequence: number[];
}

function toTrials(raw: string[], mode: "practice" | "scored"): SequenceTrial[] {
  return raw.map((digits, index) => ({
    id: `${VISUAL_SEQUENCE_ACTIVITY_CODE}-${mode}-${String(index + 1).padStart(2, "0")}`,
    sequence: [...digits].map(Number),
  }));
}

export const VISUAL_SEQUENCE_PRACTICE_TRIALS = toTrials(["26"], "practice");
export const VISUAL_SEQUENCE_SCORED_TRIALS = toTrials(
  ["647", "378", "2830", "0561", "23067", "05871", "502107", "285672"],
  "scored",
);
