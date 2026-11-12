import { describe, expect, it } from "vitest";
import {
  N_BACK_PRACTICE_TRIALS,
  N_BACK_SCORED_TRIALS,
  nBackLevel,
} from "@/features/activities/n-back/n-back-config";

describe("N-back sequences", () => {
  it("has the answer key the backend derives", () => {
    expect(N_BACK_PRACTICE_TRIALS).toHaveLength(8);
    expect(N_BACK_SCORED_TRIALS).toHaveLength(32);
    expect(N_BACK_PRACTICE_TRIALS.filter((trial) => trial.isTarget)).toHaveLength(2);
    expect(N_BACK_SCORED_TRIALS.slice(0, 16).filter((trial) => trial.isTarget)).toHaveLength(4);
    expect(N_BACK_SCORED_TRIALS.slice(16).filter((trial) => trial.isTarget)).toHaveLength(4);
    expect(N_BACK_SCORED_TRIALS[0].id).toBe("n-back-scored-01");
  });

  it("never makes a trial a target before it has N predecessors in its own level", () => {
    expect(N_BACK_SCORED_TRIALS[0].isTarget).toBe(false);
    expect(N_BACK_SCORED_TRIALS[16].isTarget).toBe(false);
    expect(N_BACK_SCORED_TRIALS[17].isTarget).toBe(false);
  });

  it("switches from 1-back to 2-back halfway through a scored run", () => {
    expect(nBackLevel("scored", 15)).toBe(1);
    expect(nBackLevel("scored", 16)).toBe(2);
    expect(nBackLevel("practice", 31)).toBe(1);
  });
});
