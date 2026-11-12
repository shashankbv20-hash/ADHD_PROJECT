import { minimumMoves, replayMoves } from "@/features/activities/planning-puzzle/planning-puzzle-config";
import type { BackendPlanningPuzzleEvent } from "@/lib/backend/types";

/**
 * Local summary shown right after a run and in demonstration mode. When research consent is granted the
 * server replays the moves and recalculates everything using the same definitions.
 *
 * Extra moves = moves made minus the minimum (2^n - 1), averaged over solved puzzles only.
 * Planning time = time from showing the puzzle to the first move, averaged over puzzles with a move.
 */
export interface PlanningPuzzleSummary {
  puzzleCount: number;
  solvedCount: number;
  solvedPercent: number | null;
  optimalCount: number;
  totalMoves: number;
  meanExtraMoves: number | null;
  illegalAttempts: number;
  meanPlanningTimeMs: number | null;
  meanSolutionTimeMs: number | null;
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

export function summarizePlanningPuzzle(events: readonly BackendPlanningPuzzleEvent[]): PlanningPuzzleSummary {
  const solved = events.filter((event) => replayMoves(event.discCount, event.moves) === true);
  const planning = events.flatMap((event) => (event.firstMoveLatencyMs === null ? [] : [event.firstMoveLatencyMs]));
  const extra = solved.map((event) => event.moves.length - minimumMoves(event.discCount));

  return {
    puzzleCount: events.length,
    solvedCount: solved.length,
    solvedPercent: events.length ? Math.round((solved.length / events.length) * 1000) / 10 : null,
    optimalCount: solved.filter((event) => event.moves.length === minimumMoves(event.discCount)).length,
    totalMoves: events.reduce((sum, event) => sum + event.moves.length, 0),
    meanExtraMoves: extra.length ? Math.round(mean(extra) * 10) / 10 : null,
    illegalAttempts: events.reduce((sum, event) => sum + event.illegalAttempts, 0),
    meanPlanningTimeMs: planning.length ? Math.round(mean(planning)) : null,
    meanSolutionTimeMs: solved.length ? Math.round(mean(solved.map((event) => event.totalTimeMs))) : null,
  };
}
