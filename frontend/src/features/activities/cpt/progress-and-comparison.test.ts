import { describe, expect, it } from "vitest";

import { CPT_SCORED_TRIALS } from "@/features/activities/cpt/cpt-config";
import { buildCptProgressSummary } from "@/features/activities/cpt/cpt-progress-data";
import {
  buildCptRunSummary,
  createCptTrialEvent,
} from "@/features/activities/cpt/scoring";
import {
  canCompareCptRuns,
  getComparableParticipantIds,
  getEligibleCptRuns,
  isEligibleCptRun,
} from "@/features/clinician/clinician-comparison-data";
import type { CptRunSummary } from "@/types";

function run(
  id: string,
  options: {
    participantId?: string;
    mode?: "practice" | "scored";
    hitAll?: boolean;
    completedAt?: string;
  } = {},
): CptRunSummary {
  const { participantId = "p-1", mode = "scored", hitAll = true, completedAt = "2026-01-01T00:00:00Z" } =
    options;
  const events = CPT_SCORED_TRIALS.map((trial, index) =>
    createCptTrialEvent(trial, index, {
      responded: hitAll && trial.isTarget,
      reactionTimeMs: hitAll && trial.isTarget ? 400 : null,
    }),
  );
  return buildCptRunSummary({ id, participantId, mode, completedAt, events });
}

describe("buildCptProgressSummary", () => {
  it("is empty with no runs", () => {
    const summary = buildCptProgressSummary([]);
    expect(summary.scoredRuns).toHaveLength(0);
    expect(summary.latestRun).toBeNull();
    expect(summary.baselineRun).toBeNull();
    expect(summary.hasTrend).toBe(false);
    expect(summary.aggregate.accuracyPercent).toBeNull();
  });

  it("excludes practice runs from progress", () => {
    const summary = buildCptProgressSummary([run("a"), run("p", { mode: "practice" })]);
    expect(summary.scoredRuns.map((r) => r.id)).toEqual(["a"]);
  });

  it("needs two scored runs before a trend is shown", () => {
    expect(buildCptProgressSummary([run("a")]).hasTrend).toBe(false);
    expect(buildCptProgressSummary([run("b"), run("a")]).hasTrend).toBe(true);
  });

  it("treats the list as newest-first (latest is first, baseline last)", () => {
    const summary = buildCptProgressSummary([run("new"), run("mid"), run("old")]);
    expect(summary.latestRun?.id).toBe("new");
    expect(summary.baselineRun?.id).toBe("old");
    expect(summary.trendPoints.map((p) => p.runId)).toEqual(["old", "mid", "new"]);
    expect(summary.trendPoints.map((p) => p.label)).toEqual(["#1", "#2", "#3"]);
  });

  it("counts complete trial logs", () => {
    expect(buildCptProgressSummary([run("a"), run("b")]).completeTrialLogCount).toBe(2);
  });
});

describe("clinician comparison eligibility", () => {
  it("accepts a complete scored CPT run", () => {
    expect(isEligibleCptRun(run("a"))).toBe(true);
  });

  it("rejects practice, blank-id and truncated-event runs", () => {
    expect(isEligibleCptRun(run("a", { mode: "practice" }))).toBe(false);
    expect(isEligibleCptRun(run("  "))).toBe(false);
    expect(isEligibleCptRun({ ...run("a"), events: [] })).toBe(false);
  });

  it("filters eligible runs", () => {
    expect(getEligibleCptRuns([run("a"), run("p", { mode: "practice" })])).toHaveLength(1);
  });

  it("lists only participants with at least two eligible runs", () => {
    const runs = [
      run("a1", { participantId: "A" }),
      run("a2", { participantId: "A" }),
      run("b1", { participantId: "B" }),
    ];
    expect(getComparableParticipantIds(runs)).toEqual(["A"]);
  });

  it("only compares different runs of the same participant", () => {
    const a1 = run("a1", { participantId: "A" });
    const a2 = run("a2", { participantId: "A" });
    const b1 = run("b1", { participantId: "B" });
    expect(canCompareCptRuns(a1, a2)).toBe(true);
    expect(canCompareCptRuns(a1, a1)).toBe(false);
    expect(canCompareCptRuns(a1, b1)).toBe(false);
  });
});
