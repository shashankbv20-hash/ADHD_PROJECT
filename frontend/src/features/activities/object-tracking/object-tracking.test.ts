import { describe, expect, it } from "vitest";
import {
  ARENA,
  makeObjects,
  OBJECT_COUNT,
  RADIUS,
  stepObjects,
  TRACKING_PRACTICE_TRIALS,
  TRACKING_SCORED_TRIALS,
} from "@/features/activities/object-tracking/object-tracking-config";
import { summarizeObjectTracking } from "@/features/activities/object-tracking/object-tracking-scoring";
import type { BackendObjectTrackingEvent } from "@/lib/backend/types";

function events({ wrong = [] as number[], partial = [] as number[], empty = [] as number[] } = {}): BackendObjectTrackingEvent[] {
  return TRACKING_SCORED_TRIALS.map((trial, index) => {
    let selected = [...trial.targets];
    if (wrong.includes(index)) selected[selected.length - 1] = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => !trial.targets.includes(i))!;
    if (partial.includes(index)) selected = selected.slice(0, -1);
    if (empty.includes(index)) selected = [];
    return {
      trialIndex: index,
      trialId: trial.id,
      objectCount: 8,
      targetCount: trial.targets.length as 2 | 3 | 4,
      selected,
      responseTimeMs: selected.length ? 3000 : null,
    };
  });
}

describe("Object Tracking trial list and motion", () => {
  it("has the shape the backend validates", () => {
    expect(TRACKING_PRACTICE_TRIALS.map((t) => t.targets.length)).toEqual([2]);
    expect(TRACKING_SCORED_TRIALS.map((t) => t.targets.length)).toEqual([2, 2, 3, 3, 4, 4]);
    expect(TRACKING_SCORED_TRIALS[0].id).toBe("multiple-object-tracking-scored-01");
    for (const trial of TRACKING_SCORED_TRIALS) {
      expect(new Set(trial.targets).size).toBe(trial.targets.length);
      expect(trial.targets.every((i) => i >= 0 && i < OBJECT_COUNT)).toBe(true);
    }
  });

  it("starts the same way every time and keeps circles inside the arena", () => {
    expect(makeObjects(3)).toEqual(makeObjects(3));
    const objects = makeObjects(5);
    for (let i = 0; i < 600; i++) stepObjects(objects, 1 / 60);
    for (const o of objects) {
      expect(o.x).toBeGreaterThanOrEqual(RADIUS);
      expect(o.x).toBeLessThanOrEqual(ARENA.width - RADIUS);
      expect(o.y).toBeGreaterThanOrEqual(RADIUS);
      expect(o.y).toBeLessThanOrEqual(ARENA.height - RADIUS);
    }
  });
});

describe("summarizeObjectTracking", () => {
  it("scores a perfect run at the highest load", () => {
    expect(summarizeObjectTracking(events())).toMatchObject({
      perfectCount: 6,
      perfectPercent: 100,
      highestPerfectLoad: 4,
      targetsFoundPercent: 100,
      wrongPickCount: 0,
    });
  });

  it("matches the backend definitions (same fixture as the backend test)", () => {
    const summary = summarizeObjectTracking(events({ wrong: [4, 5], partial: [2] }));
    expect(summary).toMatchObject({ perfectCount: 3, highestPerfectLoad: 3, wrongPickCount: 2 });
    expect(summary.byLoad.find((g) => g.targetCount === 4)?.targetsFoundPercent).toBe(75);
    expect(summary.targetsFoundPercent).toBe(Math.round(((2 + 2 + 2 + 3 + 3 + 3) / 18) * 1000) / 10);
  });

  it("withholds load and time when nothing was selected", () => {
    const summary = summarizeObjectTracking(events({ empty: [0, 1, 2, 3, 4, 5] }));
    expect(summary).toMatchObject({ perfectCount: 0, highestPerfectLoad: null, meanResponseTimeMs: null });
  });
});
