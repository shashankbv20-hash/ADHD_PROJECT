import { describe, expect, it } from "vitest";
import {
  GO_NO_GO_PRACTICE_TRIALS,
  GO_NO_GO_SCORED_TRIALS,
} from "@/features/activities/go-no-go/go-no-go-config";

describe("Go/No-Go sequences", () => {
  it("has the shape the backend validates", () => {
    expect(GO_NO_GO_PRACTICE_TRIALS).toHaveLength(8);
    expect(GO_NO_GO_SCORED_TRIALS).toHaveLength(32);
    expect(GO_NO_GO_SCORED_TRIALS.filter((trial) => !trial.isTarget)).toHaveLength(8);
    expect(GO_NO_GO_SCORED_TRIALS[0].id).toBe("go-no-go-scored-01");
    expect(GO_NO_GO_SCORED_TRIALS[31].id).toBe("go-no-go-scored-32");
  });

  it("puts two no-go trials in each block of eight and never two in a row", () => {
    for (let start = 0; start < 32; start += 8) {
      expect(
        GO_NO_GO_SCORED_TRIALS.slice(start, start + 8).filter((trial) => !trial.isTarget),
      ).toHaveLength(2);
    }
    const sequence = GO_NO_GO_SCORED_TRIALS.map((trial) => trial.stimulus).join("");
    expect(sequence).not.toContain("NN");
  });
});
