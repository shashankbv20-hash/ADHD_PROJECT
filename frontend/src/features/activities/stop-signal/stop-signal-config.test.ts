import { describe, expect, it } from "vitest";
import {
  nextStopSignalDelay,
  SSD_MAX_MS,
  SSD_MIN_MS,
  STOP_SIGNAL_PRACTICE_TRIALS,
  STOP_SIGNAL_SCORED_TRIALS,
} from "@/features/activities/stop-signal/stop-signal-config";

describe("Stop-Signal sequences", () => {
  it("has the shape the backend validates", () => {
    expect(STOP_SIGNAL_PRACTICE_TRIALS).toHaveLength(8);
    expect(STOP_SIGNAL_SCORED_TRIALS).toHaveLength(32);
    expect(STOP_SIGNAL_SCORED_TRIALS.filter((trial) => trial.isStop)).toHaveLength(8);
    expect(STOP_SIGNAL_SCORED_TRIALS[0].id).toBe("stop-signal-scored-01");
    for (let start = 0; start < 32; start += 8) {
      expect(STOP_SIGNAL_SCORED_TRIALS.slice(start, start + 8).filter((trial) => trial.isStop)).toHaveLength(2);
    }
    expect(new Set(STOP_SIGNAL_SCORED_TRIALS.map((trial) => trial.direction))).toEqual(new Set(["L", "R"]));
  });
});

describe("nextStopSignalDelay (staircase)", () => {
  it("moves in 50 ms steps and stays within the server's range", () => {
    expect(nextStopSignalDelay(250, true)).toBe(300);
    expect(nextStopSignalDelay(250, false)).toBe(200);
    expect(nextStopSignalDelay(SSD_MAX_MS, true)).toBe(SSD_MAX_MS);
    expect(nextStopSignalDelay(SSD_MIN_MS, false)).toBe(SSD_MIN_MS);
  });
});
