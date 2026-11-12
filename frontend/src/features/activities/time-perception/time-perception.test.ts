import { describe, expect, it } from "vitest";
import {
  TIME_PRACTICE_TRIALS,
  TIME_SCORED_TRIALS,
} from "@/features/activities/time-perception/time-perception-config";
import { summarizeTimePerception } from "@/features/activities/time-perception/time-perception-scoring";
import type { BackendTimePerceptionEvent } from "@/lib/backend/types";

function events({ factor = 1, skip = [] as number[] } = {}): BackendTimePerceptionEvent[] {
  return TIME_SCORED_TRIALS.map((trial, index) => ({
    trialIndex: index,
    trialId: trial.id,
    targetMs: trial.targetMs,
    reproducedMs: skip.includes(index) ? null : Math.round(trial.targetMs * factor),
  }));
}

describe("Time Perception trial list", () => {
  it("has the shape the backend validates", () => {
    expect(TIME_PRACTICE_TRIALS.map((t) => t.targetMs)).toEqual([2000]);
    expect(TIME_SCORED_TRIALS.map((t) => t.targetMs)).toEqual([3000, 1500, 4500, 2000, 3500, 1000, 4000, 2500]);
    expect(TIME_SCORED_TRIALS[0].id).toBe("time-perception-scored-01");
  });
});

describe("summarizeTimePerception", () => {
  it("scores exact reproduction as no error", () => {
    expect(summarizeTimePerception(events())).toMatchObject({
      meanAbsoluteErrorMs: 0,
      meanSignedErrorMs: 0,
      meanRatio: 1,
      ratioVariability: 0,
      withinTolerancePercent: 100,
    });
  });

  it("matches the backend definitions for over- and under-estimation", () => {
    const over = summarizeTimePerception(events({ factor: 1.5 }));
    expect(over.meanRatio).toBe(1.5);
    expect(over.meanSignedErrorMs).toBeGreaterThan(0);
    expect(over.meanAbsoluteErrorMs).toBe(over.meanSignedErrorMs);
    expect(over.withinToleranceCount).toBe(0);

    const under = summarizeTimePerception(events({ factor: 0.5, skip: [0, 1] }));
    expect(under.meanSignedErrorMs).toBeLessThan(0);
    expect(under).toMatchObject({ responseCount: 6, noResponseCount: 2, withinTolerancePercent: 0 });
  });

  it("withholds error metrics when nothing was answered", () => {
    const summary = summarizeTimePerception(events({ skip: [0, 1, 2, 3, 4, 5, 6, 7] }));
    expect(summary).toMatchObject({ meanAbsoluteErrorMs: null, meanRatio: null, ratioVariability: null });
  });
});
