import { describe, expect, it } from "vitest";
import {
  VISUAL_SEQUENCE_PRACTICE_TRIALS,
  VISUAL_SEQUENCE_SCORED_TRIALS,
} from "@/features/activities/visual-sequence/visual-sequence-config";
import { summarizeVisualSequence } from "@/features/activities/visual-sequence/visual-sequence-scoring";
import type { BackendVisualSequenceEvent } from "@/lib/backend/types";

function events({ wrong = [] as number[], short = [] as number[], empty = [] as number[] } = {}): BackendVisualSequenceEvent[] {
  return VISUAL_SEQUENCE_SCORED_TRIALS.map((trial, index) => {
    let response = [...trial.sequence];
    if (wrong.includes(index)) response[response.length - 1] = (response[response.length - 1] + 1) % 9;
    if (short.includes(index)) response = response.slice(0, -2);
    if (empty.includes(index)) response = [];
    return {
      trialIndex: index,
      trialId: trial.id,
      sequenceLength: trial.sequence.length,
      response,
      firstResponseLatencyMs: response.length ? 800 : null,
      totalResponseTimeMs: 800 + 500 * response.length,
    };
  });
}

describe("Visual Sequence trial list", () => {
  it("has the shape the backend validates", () => {
    expect(VISUAL_SEQUENCE_PRACTICE_TRIALS.map((t) => t.sequence.length)).toEqual([2]);
    expect(VISUAL_SEQUENCE_SCORED_TRIALS.map((t) => t.sequence.length)).toEqual([3, 3, 4, 4, 5, 5, 6, 6]);
    expect(VISUAL_SEQUENCE_SCORED_TRIALS[0].id).toBe("visual-sequence-scored-01");
    for (const trial of VISUAL_SEQUENCE_SCORED_TRIALS) {
      expect(trial.sequence.every((cell, i) => i === 0 || cell !== trial.sequence[i - 1])).toBe(true);
    }
  });
});

describe("summarizeVisualSequence", () => {
  it("scores a perfect run", () => {
    expect(summarizeVisualSequence(events())).toMatchObject({
      correctCount: 8,
      accuracyPercent: 100,
      longestCorrectSpan: 6,
      correctPositionPercent: 100,
      meanFirstResponseMs: 800,
    });
  });

  it("matches the backend definitions (same fixture as the backend test)", () => {
    const summary = summarizeVisualSequence(events({ wrong: [6], short: [7] }));
    expect(summary).toMatchObject({ correctCount: 6, longestCorrectSpan: 5, correctPositionPercent: 91.7 });
  });

  it("withholds span and latency when nothing was tapped", () => {
    const summary = summarizeVisualSequence(events({ empty: [0, 1, 2, 3, 4, 5, 6, 7] }));
    expect(summary).toMatchObject({ noResponseCount: 8, longestCorrectSpan: null, meanFirstResponseMs: null });
  });
});
