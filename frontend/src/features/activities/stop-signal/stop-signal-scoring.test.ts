import { describe, expect, it } from "vitest";
import { summarizeStopSignal } from "@/features/activities/stop-signal/stop-signal-scoring";
import { STOP_SIGNAL_SCORED_TRIALS } from "@/features/activities/stop-signal/stop-signal-config";
import type { BackendStopSignalEvent } from "@/lib/backend/types";

function events({
  failStops = 0,
  skipGo = [] as number[],
  wrongDirection = [] as number[],
} = {}): BackendStopSignalEvent[] {
  let stopsFailed = 0;
  return STOP_SIGNAL_SCORED_TRIALS.map((trial, index) => {
    let responded = !trial.isStop && !skipGo.includes(index);
    if (trial.isStop && stopsFailed < failStops) {
      responded = true;
      stopsFailed += 1;
    }
    const opposite = trial.direction === "L" ? "R" : "L";
    return {
      trialIndex: index,
      trialId: trial.id,
      stimulus: trial.direction,
      isStop: trial.isStop,
      stopSignalDelayMs: trial.isStop ? 250 : null,
      responded,
      responseDirection: responded ? (wrongDirection.includes(index) ? opposite : trial.direction) : null,
      reactionTimeMs: responded ? 500 : null,
    };
  });
}

describe("summarizeStopSignal", () => {
  it("matches the backend definitions (same fixture as the backend test)", () => {
    const summary = summarizeStopSignal(events({ failStops: 3, skipGo: [0], wrongDirection: [1] }));

    expect(summary).toMatchObject({
      goTrialCount: 24,
      stopTrialCount: 8,
      goOmissionCount: 1,
      goWrongDirectionCount: 1,
      goCorrectCount: 22,
      failedStopCount: 3,
      successfulStopCount: 5,
      stopSuccessRatePercent: 62.5,
      meanStopSignalDelayMs: 250,
      meanGoReactionTimeMs: 500,
      ssrtReliable: true,
      ssrtEstimateMs: 250,
    });
  });

  it("withholds SSRT when every stop succeeded or every stop failed", () => {
    expect(summarizeStopSignal(events()).ssrtEstimateMs).toBeNull();
    expect(summarizeStopSignal(events({ failStops: 8 })).ssrtReliable).toBe(false);
  });
});
