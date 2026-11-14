import { describe, expect, it } from "vitest";
import { ACTIVITY_RESULTS, LOCAL_CELLS } from "@/features/activities/activity-results";
import { calculateCptMetrics } from "@/features/activities/cpt/scoring";
import { summarizeObjectTracking } from "@/features/activities/object-tracking/object-tracking-scoring";
import { summarizePlanningPuzzle } from "@/features/activities/planning-puzzle/planning-puzzle-scoring";
import { recordRun } from "@/features/activities/run-log";
import { summarizeStopSignal } from "@/features/activities/stop-signal/stop-signal-scoring";
import { summarizeStroop } from "@/features/activities/stroop/stroop-scoring";
import { summarizeTaskSwitching } from "@/features/activities/task-switching/task-switching-scoring";
import { summarizeTimePerception } from "@/features/activities/time-perception/time-perception-scoring";
import { summarizeVisualSearch } from "@/features/activities/visual-search/visual-search-scoring";
import { summarizeVisualSequence } from "@/features/activities/visual-sequence/visual-sequence-scoring";

const cptMetrics = calculateCptMetrics([]);

const cells = {
  "go-no-go": LOCAL_CELLS["go-no-go"](cptMetrics),
  "stop-signal": LOCAL_CELLS["stop-signal"](summarizeStopSignal([])),
  "n-back": LOCAL_CELLS["n-back"]({ metrics: cptMetrics, oneBackAccuracy: 80, twoBackAccuracy: null }),
  stroop: LOCAL_CELLS.stroop(summarizeStroop([])),
  "task-switching": LOCAL_CELLS["task-switching"](summarizeTaskSwitching([])),
  "visual-search": LOCAL_CELLS["visual-search"](summarizeVisualSearch([])),
  "planning-puzzle": LOCAL_CELLS["planning-puzzle"](summarizePlanningPuzzle([])),
  "visual-sequence": LOCAL_CELLS["visual-sequence"](summarizeVisualSequence([])),
  "time-perception": LOCAL_CELLS["time-perception"](summarizeTimePerception([])),
  "multiple-object-tracking": LOCAL_CELLS["multiple-object-tracking"](summarizeObjectTracking([])),
};

describe("activity results registry", () => {
  it("lists every activity once, each with its own columns", () => {
    expect(ACTIVITY_RESULTS).toHaveLength(10);
    expect(new Set(ACTIVITY_RESULTS.map((a) => a.id)).size).toBe(10);
    for (const activity of ACTIVITY_RESULTS) {
      expect(activity.columns.length).toBeGreaterThan(2);
      expect(activity.href).toBe(`/participant/activities/${activity.id}`);
    }
  });

  it("builds one cell per column for runs from the browser", () => {
    for (const activity of ACTIVITY_RESULTS) {
      expect(cells[activity.id]).toHaveLength(activity.columns.length);
    }
  });

  it("builds one cell per column for runs saved to the backend", () => {
    const empty: never[] = [];
    const sync = {
      goNoGoRuns: [{ id: "g", completedAt: "t", accuracyPercent: 90, correctGo: 20, omissions: 1, commissions: 2, correctHoldBack: 6, meanGoReactionTimeMs: 400 }],
      stopSignalRuns: [{ id: "s", completedAt: "t", goAccuracyPercent: 95, meanGoReactionTimeMs: 450, stopSuccessRatePercent: 50, meanStopSignalDelayMs: 300, ssrtEstimateMs: 200, ssrtReliable: true }],
      nBackRuns: [{ id: "n", completedAt: "t", accuracyPercent: 80, hits: 5, misses: 3, falseAlarms: 1, oneBackAccuracyPercent: 90, twoBackAccuracyPercent: null }],
      stroopRuns: [{ id: "r", completedAt: "t", accuracyPercent: 90, congruentAccuracyPercent: 95, incongruentAccuracyPercent: 85, interferenceMs: 120, errors: 2, omissions: 1 }],
      taskSwitchingRuns: [{ id: "t", completedAt: "t", accuracyPercent: 90, repeatAccuracyPercent: 95, switchAccuracyPercent: 85, switchCostMs: 150, errors: 2, omissions: 1 }],
      visualSearchRuns: [{ id: "v", completedAt: "t", accuracyPercent: 90, meanReactionTimeMs: 1200, searchSlopeMsPerItem: 40, errors: 2, omissions: 1 }],
      planningPuzzleRuns: [{ id: "p", completedAt: "t", puzzleCount: 3, solvedCount: 2, meanExtraMoves: 1.5, meanPlanningTimeMs: 2500, illegalAttempts: 3 }],
      visualSequenceRuns: [{ id: "q", completedAt: "t", trialCount: 8, correctCount: 6, longestCorrectSpan: 5, correctPositionPercent: 90 }],
      timePerceptionRuns: [{ id: "x", completedAt: "t", trialCount: 8, withinToleranceCount: 5, meanAbsoluteErrorMs: 400, meanSignedErrorMs: -100, meanRatio: 0.9 }],
      objectTrackingRuns: [{ id: "o", completedAt: "t", trialCount: 6, perfectCount: 4, targetsFoundPercent: 88.9, highestPerfectLoad: 3 }],
      unused: empty,
    } as unknown as Parameters<(typeof ACTIVITY_RESULTS)[number]["fromServer"]>[0];

    for (const activity of ACTIVITY_RESULTS) {
      const rows = activity.fromServer(sync);
      expect(rows).toHaveLength(1);
      expect(rows[0].cells).toHaveLength(activity.columns.length);
    }
  });

  it("records a run without throwing", () => {
    expect(() => recordRun("stroop", "run-1", summarizeStroop([]))).not.toThrow();
  });
});
