/**
 * Visual Search trial list. It must match the backend's validated list
 * (backend/app/services/visual_search.py); the server derives the correct answer and grid size from it
 * and rejects a run that differs.
 *
 * Target: a red T. Distractors: blue T and red L. Grids have 4, 8 or 12 items.
 * Left key (F) = target present, right key (J) = target absent.
 */
export const VISUAL_SEARCH_ACTIVITY_CODE = "visual-search";
export const VISUAL_SEARCH_RESPONSE_WINDOW_MS = 2200;

export const VISUAL_SEARCH_KEYS: Record<string, "present" | "absent"> = {
  ArrowLeft: "present",
  ArrowRight: "absent",
  f: "present",
  j: "absent",
};

const SIZES = { S: 4, M: 8, L: 12 } as const;

export interface SearchItem {
  letter: "T" | "L";
  colour: "red" | "blue";
}

export interface VisualSearchTrial {
  id: string;
  setSize: 4 | 8 | 12;
  targetPresent: boolean;
  items: SearchItem[];
}

/** Small deterministic generator so the same trial always shows the same layout. */
function seeded(seed: number) {
  let state = seed * 2654435761 + 12345;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function layout(index: number, setSize: number, targetPresent: boolean): SearchItem[] {
  const items: SearchItem[] = [];
  if (targetPresent) items.push({ letter: "T", colour: "red" });
  while (items.length < setSize) {
    // Alternate the two distractor types so each appears about equally often.
    items.push(items.length % 2 === 0 ? { letter: "T", colour: "blue" } : { letter: "L", colour: "red" });
  }
  const random = seeded(index + 1);
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function toTrials(sizes: string, present: string, mode: "practice" | "scored"): VisualSearchTrial[] {
  return [...sizes].map((code, index) => {
    const setSize = SIZES[code as keyof typeof SIZES];
    const targetPresent = present[index] === "1";
    return {
      id: `${VISUAL_SEARCH_ACTIVITY_CODE}-${mode}-${String(index + 1).padStart(2, "0")}`,
      setSize,
      targetPresent,
      items: layout(index + (mode === "scored" ? 100 : 0), setSize, targetPresent),
    };
  });
}

export const VISUAL_SEARCH_PRACTICE_TRIALS = toTrials("SSMLML", "010011", "practice");
export const VISUAL_SEARCH_SCORED_TRIALS = toTrials(
  "LLMSMSMMSLLSLLSMLSMSMLLMMSSMSL",
  "010011001001110100110011000111",
  "scored",
);
