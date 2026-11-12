import { describe, expect, it } from "vitest";
import {
  correctSide,
  TASK_SWITCHING_PRACTICE_TRIALS,
  TASK_SWITCHING_SCORED_TRIALS,
} from "@/features/activities/task-switching/task-switching-config";
import { summarizeTaskSwitching } from "@/features/activities/task-switching/task-switching-scoring";
import type { BackendTaskSwitchingEvent } from "@/lib/backend/types";

function events({ wrong = [] as number[], skip = [] as number[] } = {}): BackendTaskSwitchingEvent[] {
  return TASK_SWITCHING_SCORED_TRIALS.map((trial, index) => {
    const answered = !skip.includes(index);
    const right = correctSide(trial);
    return {
      trialIndex: index,
      trialId: trial.id,
      rule: trial.rule,
      colour: trial.colour,
      shape: trial.shape,
      responded: answered,
      responseSide: answered ? (wrong.includes(index) ? (right === "L" ? "R" : "L") : right) : null,
      reactionTimeMs: answered ? (trial.type === "switch" ? 700 : 500) : null,
    };
  });
}

describe("Task Switching trial list", () => {
  it("has the shape the backend validates", () => {
    expect(TASK_SWITCHING_PRACTICE_TRIALS).toHaveLength(8);
    expect(TASK_SWITCHING_SCORED_TRIALS).toHaveLength(32);
    expect(TASK_SWITCHING_SCORED_TRIALS.filter((t) => t.type === "switch")).toHaveLength(16);
    expect(TASK_SWITCHING_SCORED_TRIALS.filter((t) => t.type === "repeat")).toHaveLength(15);
    expect(TASK_SWITCHING_SCORED_TRIALS[0].id).toBe("task-switching-scored-01");
  });

  it("maps rules to sides like the backend", () => {
    expect(correctSide({ rule: "colour", colour: "R", shape: "Q" })).toBe("L");
    expect(correctSide({ rule: "colour", colour: "B", shape: "O" })).toBe("R");
    expect(correctSide({ rule: "shape", colour: "R", shape: "Q" })).toBe("R");
    expect(correctSide({ rule: "shape", colour: "B", shape: "O" })).toBe("L");
  });
});

describe("summarizeTaskSwitching", () => {
  it("matches the backend definitions (same fixture as the backend test)", () => {
    const switchIdx = TASK_SWITCHING_SCORED_TRIALS.map((t, i) => (t.type === "switch" ? i : -1)).filter((i) => i >= 0);
    const summary = summarizeTaskSwitching(events({ wrong: [switchIdx[0]], skip: [switchIdx[1]] }));

    expect(summary).toMatchObject({
      switchTrialCount: 16,
      repeatTrialCount: 15,
      errorCount: 1,
      omissionCount: 1,
      repeatAccuracyPercent: 100,
      switchAccuracyPercent: 87.5,
      meanRepeatReactionTimeMs: 500,
      meanSwitchReactionTimeMs: 700,
      switchCostMs: 200,
    });
  });

  it("withholds switch cost when a condition has no correct answers", () => {
    const all = TASK_SWITCHING_SCORED_TRIALS.map((t, i) => (t.type === "switch" ? i : -1)).filter((i) => i >= 0);
    expect(summarizeTaskSwitching(events({ skip: all })).switchCostMs).toBeNull();
  });
});
