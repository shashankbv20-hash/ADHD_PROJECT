import type { StroopColor } from "@/lib/backend/types";

/**
 * Stroop trial list. It must match the backend's validated list (backend/app/services/stroop.py);
 * the server derives congruence from the word and ink and rejects a run that differs.
 * Every block of 8 trials has 4 congruent (word and ink agree) and 4 incongruent trials.
 */
export const STROOP_ACTIVITY_CODE = "stroop";
export const STROOP_RESPONSE_WINDOW_MS = 2200;

export const STROOP_COLORS: Record<StroopColor, { name: string; css: string; button: string }> = {
  R: { name: "RED", css: "text-red-600", button: "bg-red-600 hover:bg-red-700" },
  G: { name: "GREEN", css: "text-green-600", button: "bg-green-600 hover:bg-green-700" },
  B: { name: "BLUE", css: "text-blue-600", button: "bg-blue-600 hover:bg-blue-700" },
  Y: { name: "YELLOW", css: "text-yellow-500", button: "bg-yellow-500 hover:bg-yellow-600 text-ink" },
};

export const STROOP_KEYS: Record<string, StroopColor> = { r: "R", g: "G", b: "B", y: "Y" };

export interface StroopTrial {
  id: string;
  word: StroopColor;
  ink: StroopColor;
  congruent: boolean;
}

function toTrials(words: string, inks: string, mode: "practice" | "scored"): StroopTrial[] {
  return [...words].map((word, index) => ({
    id: `${STROOP_ACTIVITY_CODE}-${mode}-${String(index + 1).padStart(2, "0")}`,
    word: word as StroopColor,
    ink: inks[index] as StroopColor,
    congruent: word === inks[index],
  }));
}

export const STROOP_PRACTICE_TRIALS = toTrials("RGBYGRYB", "RBBRGYYG", "practice");
export const STROOP_SCORED_TRIALS = toTrials(
  "RGBYGRYB" + "GYRBRGYY" + "BRYGBYRG" + "YBGRYGBR",
  "RBBGGYYR" + "YYGBRBYG" + "RRYBBGRB" + "YGGRBGYY",
  "scored",
);
