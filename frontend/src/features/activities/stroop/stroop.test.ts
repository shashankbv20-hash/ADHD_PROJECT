import { describe, expect, it } from "vitest";
import { STROOP_PRACTICE_TRIALS, STROOP_SCORED_TRIALS } from "@/features/activities/stroop/stroop-config";
import { summarizeStroop } from "@/features/activities/stroop/stroop-scoring";
import type { BackendStroopEvent, StroopColor } from "@/lib/backend/types";

function events({ wrong = [] as number[], skip = [] as number[], onlyCongruent = false } = {}): BackendStroopEvent[] {
  return STROOP_SCORED_TRIALS.map((trial, index) => {
    const answered = !skip.includes(index) && !(onlyCongruent && !trial.congruent);
    const other = (["R", "G", "B", "Y"] as StroopColor[]).find((color) => color !== trial.ink)!;
    return {
      trialIndex: index,
      trialId: trial.id,
      word: trial.word,
      ink: trial.ink,
      responded: answered,
      responseColor: answered ? (wrong.includes(index) ? other : trial.ink) : null,
      reactionTimeMs: answered ? (trial.congruent ? 500 : 650) : null,
    };
  });
}

describe("Stroop trial list", () => {
  it("has the shape the backend validates", () => {
    expect(STROOP_PRACTICE_TRIALS).toHaveLength(8);
    expect(STROOP_SCORED_TRIALS).toHaveLength(32);
    for (let start = 0; start < 32; start += 8) {
      expect(STROOP_SCORED_TRIALS.slice(start, start + 8).filter((trial) => trial.congruent)).toHaveLength(4);
    }
    expect(STROOP_SCORED_TRIALS[0].id).toBe("stroop-scored-01");
  });
});

describe("summarizeStroop", () => {
  it("matches the backend definitions (same fixture as the backend test)", () => {
    const incongruent = STROOP_SCORED_TRIALS.map((trial, index) => (trial.congruent ? -1 : index)).filter((i) => i >= 0);
    const summary = summarizeStroop(events({ wrong: [incongruent[0]], skip: [incongruent[1]] }));

    expect(summary).toMatchObject({
      congruentTrialCount: 16,
      incongruentTrialCount: 16,
      errorCount: 1,
      omissionCount: 1,
      congruentAccuracyPercent: 100,
      incongruentAccuracyPercent: 87.5,
      meanCongruentReactionTimeMs: 500,
      meanIncongruentReactionTimeMs: 650,
      interferenceMs: 150,
    });
  });

  it("withholds interference when a condition has no correct answers", () => {
    expect(summarizeStroop(events({ onlyCongruent: true })).interferenceMs).toBeNull();
  });
});
