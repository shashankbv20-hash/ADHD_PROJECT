import { describe, expect, it } from "vitest";

import {
  CPT_PRACTICE_STIMULI,
  CPT_PRACTICE_TRIALS,
  CPT_SCORED_STIMULI,
  CPT_SCORED_TRIALS,
  CPT_TARGET_STIMULUS,
} from "@/features/activities/cpt/cpt-config";
import {
  aggregateCptMetrics,
  buildCptRunSummary,
  calculateCptMetrics,
  createCptTrialEvent,
} from "@/features/activities/cpt/scoring";
import type { CptTrialEvent } from "@/types";

const target = { id: "t-1", stimulus: "X", isTarget: true };
const nonTarget = { id: "t-2", stimulus: "A", isTarget: false };

function scoredEvents(
  respond: (index: number, isTarget: boolean) => boolean,
  reactionTimeMs = 400,
): CptTrialEvent[] {
  return CPT_SCORED_TRIALS.map((trial, index) =>
    createCptTrialEvent(trial, index, {
      responded: respond(index, trial.isTarget),
      reactionTimeMs: respond(index, trial.isTarget) ? reactionTimeMs : null,
    }),
  );
}

describe("CPT stimulus configuration (must match backend/app/services/cpt_scoring.py)", () => {
  it("has the 6-trial practice and 24-trial scored sequences", () => {
    expect(CPT_PRACTICE_STIMULI).toHaveLength(6);
    expect(CPT_SCORED_STIMULI).toHaveLength(24);
  });

  it("has 2 practice targets and 6 scored targets", () => {
    expect(CPT_PRACTICE_TRIALS.filter((t) => t.isTarget)).toHaveLength(2);
    expect(CPT_SCORED_TRIALS.filter((t) => t.isTarget)).toHaveLength(6);
  });

  it("marks only the target stimulus as a target", () => {
    for (const trial of CPT_SCORED_TRIALS) {
      expect(trial.isTarget).toBe(trial.stimulus === CPT_TARGET_STIMULUS);
    }
  });

  it("generates stable zero-padded trial ids", () => {
    expect(CPT_SCORED_TRIALS[0].id).toBe("cpt-scored-01");
    expect(CPT_SCORED_TRIALS[23].id).toBe("cpt-scored-24");
    expect(CPT_PRACTICE_TRIALS[5].id).toBe("cpt-practice-06");
  });

  it("matches the exact scored sequence shared with the backend", () => {
    expect(CPT_SCORED_STIMULI.join("")).toBe("AXBCDXBAXCDBXACDXBACDXBA");
    expect(CPT_PRACTICE_STIMULI.join("")).toBe("AXBCXD");
  });
});

describe("createCptTrialEvent", () => {
  it.each([
    [target, true, "hit"],
    [target, false, "miss"],
    [nonTarget, true, "false-alarm"],
    [nonTarget, false, "correct-rejection"],
  ] as const)("classifies %o responded=%s as %s", (trial, responded, outcome) => {
    const event = createCptTrialEvent(trial, 0, {
      responded,
      reactionTimeMs: responded ? 300 : null,
    });
    expect(event.outcome).toBe(outcome);
  });

  it("rounds reaction times", () => {
    const event = createCptTrialEvent(target, 0, { responded: true, reactionTimeMs: 301.6 });
    expect(event.reactionTimeMs).toBe(302);
  });

  it.each([-5, Number.NaN, Number.POSITIVE_INFINITY, null])(
    "drops invalid reaction time %s",
    (reactionTimeMs) => {
      const event = createCptTrialEvent(target, 0, { responded: true, reactionTimeMs });
      expect(event.reactionTimeMs).toBeNull();
    },
  );

  it("never records a reaction time without a response", () => {
    const event = createCptTrialEvent(target, 0, { responded: false, reactionTimeMs: 250 });
    expect(event.reactionTimeMs).toBeNull();
  });

  it("keeps trial identity fields", () => {
    expect(createCptTrialEvent(target, 7, { responded: false, reactionTimeMs: null })).toMatchObject({
      trialIndex: 7,
      trialId: "t-1",
      stimulus: "X",
      isTarget: true,
    });
  });
});

describe("calculateCptMetrics", () => {
  it("scores a perfect run", () => {
    const metrics = calculateCptMetrics(scoredEvents((_i, isTarget) => isTarget, 400));
    expect(metrics).toMatchObject({
      trialCount: 24,
      targetCount: 6,
      nonTargetCount: 18,
      responseCount: 6,
      hitCount: 6,
      missCount: 0,
      falseAlarmCount: 0,
      correctRejectionCount: 18,
      accuracyPercent: 100,
      meanHitReactionTimeMs: 400,
      validReactionTimeCount: 6,
      hitReactionTimeTotalMs: 2400,
    });
  });

  it("scores a run with no responses", () => {
    const metrics = calculateCptMetrics(scoredEvents(() => false));
    expect(metrics.hitCount).toBe(0);
    expect(metrics.missCount).toBe(6);
    expect(metrics.correctRejectionCount).toBe(18);
    expect(metrics.accuracyPercent).toBe(75);
    expect(metrics.meanHitReactionTimeMs).toBeNull();
  });

  it("scores a respond-to-everything run", () => {
    const metrics = calculateCptMetrics(scoredEvents(() => true));
    expect(metrics.hitCount).toBe(6);
    expect(metrics.falseAlarmCount).toBe(18);
    expect(metrics.accuracyPercent).toBe(25);
  });

  it("keeps the identities that the Firestore rules enforce", () => {
    const m = calculateCptMetrics(scoredEvents((i) => i % 3 === 0));
    expect(m.hitCount + m.missCount).toBe(m.targetCount);
    expect(m.falseAlarmCount + m.correctRejectionCount).toBe(m.nonTargetCount);
    expect(m.responseCount).toBe(m.hitCount + m.falseAlarmCount);
  });

  it("returns null accuracy and zero counts for an empty run", () => {
    const metrics = calculateCptMetrics([]);
    expect(metrics.trialCount).toBe(0);
    expect(metrics.accuracyPercent).toBeNull();
    expect(metrics.meanHitReactionTimeMs).toBeNull();
  });

  it("ignores false-alarm reaction times in the hit mean", () => {
    const events = [
      createCptTrialEvent(target, 0, { responded: true, reactionTimeMs: 500 }),
      createCptTrialEvent(nonTarget, 1, { responded: true, reactionTimeMs: 100 }),
    ];
    expect(calculateCptMetrics(events).meanHitReactionTimeMs).toBe(500);
  });
});

describe("aggregateCptMetrics", () => {
  it("weights reaction time by valid hit counts, not by run", () => {
    const fast = calculateCptMetrics(scoredEvents((_i, t) => t, 300)); // 6 hits @300
    const slow = calculateCptMetrics(
      scoredEvents((i, t) => t && i < 2 * 99, 600).slice(0, 12), // partial run
    );
    const aggregate = aggregateCptMetrics([fast, slow]);
    expect(aggregate.trialCount).toBe(fast.trialCount + slow.trialCount);
    const expectedMean = Math.round(
      ((fast.hitReactionTimeTotalMs ?? 0) + (slow.hitReactionTimeTotalMs ?? 0)) /
        (fast.validReactionTimeCount + slow.validReactionTimeCount),
    );
    expect(aggregate.meanHitReactionTimeMs).toBe(expectedMean);
  });

  it("matches scoring all events at once", () => {
    const a = scoredEvents((i) => i % 2 === 0, 350);
    const b = scoredEvents((i) => i % 4 === 0, 450);
    const merged = calculateCptMetrics([...a, ...b]);
    const aggregated = aggregateCptMetrics([calculateCptMetrics(a), calculateCptMetrics(b)]);
    expect(aggregated).toEqual(merged);
  });

  it("returns null measures for no summaries", () => {
    const aggregate = aggregateCptMetrics([]);
    expect(aggregate.accuracyPercent).toBeNull();
    expect(aggregate.meanHitReactionTimeMs).toBeNull();
  });
});

describe("buildCptRunSummary", () => {
  it("labels summaries as demo data and embeds the metrics", () => {
    const events = scoredEvents((_i, t) => t);
    const summary = buildCptRunSummary({
      id: "run-1",
      participantId: "p-1",
      mode: "scored",
      completedAt: "2026-01-01T00:00:00.000Z",
      events,
    });
    expect(summary.isDemo).toBe(true);
    expect(summary.activityId).toBe("cpt");
    expect(summary.accuracyPercent).toBe(100);
    expect(summary.events).toBe(events);
  });
});
