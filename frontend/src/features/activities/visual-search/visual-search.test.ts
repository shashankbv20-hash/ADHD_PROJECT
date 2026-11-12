import { describe, expect, it } from "vitest";
import {
  VISUAL_SEARCH_PRACTICE_TRIALS,
  VISUAL_SEARCH_SCORED_TRIALS,
} from "@/features/activities/visual-search/visual-search-config";
import { summarizeVisualSearch } from "@/features/activities/visual-search/visual-search-scoring";
import type { BackendVisualSearchEvent } from "@/lib/backend/types";

const rt = (size: number, present: boolean) => 400 + 50 * size + (present ? 0 : 300);

function events({ wrong = [] as number[], skip = [] as number[] } = {}): BackendVisualSearchEvent[] {
  return VISUAL_SEARCH_SCORED_TRIALS.map((trial, index) => {
    const answered = !skip.includes(index);
    const saysPresent = wrong.includes(index) ? !trial.targetPresent : trial.targetPresent;
    return {
      trialIndex: index,
      trialId: trial.id,
      setSize: trial.setSize,
      targetPresent: trial.targetPresent,
      responded: answered,
      response: answered ? (saysPresent ? "present" : "absent") : null,
      reactionTimeMs: answered ? rt(trial.setSize, trial.targetPresent) : null,
    };
  });
}

describe("Visual Search trial list", () => {
  it("has the shape the backend validates", () => {
    expect(VISUAL_SEARCH_PRACTICE_TRIALS).toHaveLength(6);
    expect(VISUAL_SEARCH_SCORED_TRIALS).toHaveLength(30);
    for (const size of [4, 8, 12]) {
      const group = VISUAL_SEARCH_SCORED_TRIALS.filter((t) => t.setSize === size);
      expect(group).toHaveLength(10);
      expect(group.filter((t) => t.targetPresent)).toHaveLength(5);
    }
  });

  it("draws exactly one target when present and none when absent", () => {
    for (const trial of VISUAL_SEARCH_SCORED_TRIALS) {
      const targets = trial.items.filter((i) => i.letter === "T" && i.colour === "red");
      expect(trial.items).toHaveLength(trial.setSize);
      expect(targets).toHaveLength(trial.targetPresent ? 1 : 0);
    }
  });
});

describe("summarizeVisualSearch", () => {
  it("matches the backend definitions (same fixture as the backend test)", () => {
    const presentIdx = VISUAL_SEARCH_SCORED_TRIALS.map((t, i) => (t.targetPresent ? i : -1)).filter((i) => i >= 0);
    const summary = summarizeVisualSearch(events({ wrong: [presentIdx[0]], skip: [presentIdx[1]] }));

    expect(summary).toMatchObject({
      targetPresentCount: 15,
      targetAbsentCount: 15,
      errorCount: 1,
      omissionCount: 1,
      absentAccuracyPercent: 100,
      presentAccuracyPercent: 86.7,
      accuracyPercent: 93.3,
      searchSlopeMsPerItem: 50,
    });
  });

  it("withholds the slope with fewer than two grid sizes", () => {
    const skip = VISUAL_SEARCH_SCORED_TRIALS.map((t, i) => (t.setSize !== 4 ? i : -1)).filter((i) => i >= 0);
    expect(summarizeVisualSearch(events({ skip })).searchSlopeMsPerItem).toBeNull();
  });
});
