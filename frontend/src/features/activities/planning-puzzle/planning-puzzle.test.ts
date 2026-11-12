import { describe, expect, it } from "vitest";
import {
  applyMove,
  canMove,
  minimumMoves,
  PLANNING_PRACTICE_PUZZLES,
  PLANNING_SCORED_PUZZLES,
  replayMoves,
  startingPegs,
} from "@/features/activities/planning-puzzle/planning-puzzle-config";
import { summarizePlanningPuzzle } from "@/features/activities/planning-puzzle/planning-puzzle-scoring";
import type { BackendPlanningPuzzleEvent } from "@/lib/backend/types";

function optimal(discs: number, from = "A", to = "C", spare = "B"): string[] {
  if (discs === 0) return [];
  return [...optimal(discs - 1, from, spare, to), from + to, ...optimal(discs - 1, spare, to, from)];
}

function events({ detour = [] as number[], unsolved = [] as number[] } = {}): BackendPlanningPuzzleEvent[] {
  return PLANNING_SCORED_PUZZLES.map((puzzle, index) => {
    let moves = optimal(puzzle.discs);
    if (detour.includes(index)) moves = ["AB", "BA", ...moves];
    if (unsolved.includes(index)) moves = moves.slice(0, -1);
    return {
      trialIndex: index,
      trialId: puzzle.id,
      discCount: puzzle.discs,
      moves,
      illegalAttempts: index === 0 ? 1 : 0,
      firstMoveLatencyMs: 2000,
      totalTimeMs: 20000 + 1000 * moves.length,
    };
  });
}

describe("Planning Puzzle rules", () => {
  it("lists the puzzles the backend validates", () => {
    expect(PLANNING_PRACTICE_PUZZLES.map((p) => p.discs)).toEqual([3]);
    expect(PLANNING_SCORED_PUZZLES.map((p) => p.discs)).toEqual([3, 3, 4]);
    expect(PLANNING_SCORED_PUZZLES[0].id).toBe("planning-puzzle-scored-01");
  });

  it("only allows legal moves", () => {
    const start = startingPegs(3);
    expect(canMove(start, "A", "C")).toBe(true);
    expect(canMove(start, "B", "C")).toBe(false);
    const after = applyMove(start, "A", "C");
    expect(canMove(after, "A", "C")).toBe(false); // larger disc onto the smaller one
    expect(canMove(after, "A", "B")).toBe(true);
  });

  it("replays like the server", () => {
    expect(minimumMoves(4)).toBe(15);
    expect(replayMoves(3, optimal(3))).toBe(true);
    expect(replayMoves(3, optimal(3).slice(0, -1))).toBe(false);
    expect(replayMoves(3, ["AC", "AC"])).toBeNull();
    expect(replayMoves(3, [...optimal(3), "CA"])).toBeNull();
  });
});

describe("summarizePlanningPuzzle", () => {
  it("matches the backend definitions (same fixture as the backend test)", () => {
    const summary = summarizePlanningPuzzle(events({ detour: [1], unsolved: [2] }));
    expect(summary).toMatchObject({
      puzzleCount: 3,
      solvedCount: 2,
      solvedPercent: 66.7,
      optimalCount: 1,
      meanExtraMoves: 1,
      illegalAttempts: 1,
      meanPlanningTimeMs: 2000,
      totalMoves: 7 + 9 + 14,
    });
  });
});
