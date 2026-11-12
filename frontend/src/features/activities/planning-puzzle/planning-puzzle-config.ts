/**
 * Planning Puzzle (Tower of Hanoi). The puzzle list must match the backend
 * (backend/app/services/planning_puzzle.py); the server replays every move itself.
 *
 * Pegs A, B, C. All discs start on A (smallest on top); move them all to C, one disc at a time,
 * never a larger disc onto a smaller one. A move is written "AB" = top disc from A to B.
 */
export const PLANNING_PUZZLE_ACTIVITY_CODE = "planning-puzzle";
export const PLANNING_PUZZLE_TIME_LIMIT_MS = 120_000;

export type Peg = "A" | "B" | "C";
export const PEGS: Peg[] = ["A", "B", "C"];

/** Pegs hold disc sizes from bottom to top (1 is the smallest). */
export type PegState = Record<Peg, number[]>;

export interface PlanningPuzzle {
  id: string;
  discs: 3 | 4;
}

function toPuzzles(discs: (3 | 4)[], mode: "practice" | "scored"): PlanningPuzzle[] {
  return discs.map((count, index) => ({
    id: `${PLANNING_PUZZLE_ACTIVITY_CODE}-${mode}-${String(index + 1).padStart(2, "0")}`,
    discs: count,
  }));
}

export const PLANNING_PRACTICE_PUZZLES = toPuzzles([3], "practice");
export const PLANNING_SCORED_PUZZLES = toPuzzles([3, 3, 4], "scored");

export const minimumMoves = (discs: number) => 2 ** discs - 1;

export function startingPegs(discs: number): PegState {
  return { A: Array.from({ length: discs }, (_, i) => discs - i), B: [], C: [] };
}

/** Whether moving the top disc from one peg to another is allowed. */
export function canMove(pegs: PegState, from: Peg, to: Peg): boolean {
  const source = pegs[from];
  if (from === to || source.length === 0) return false;
  const target = pegs[to];
  return target.length === 0 || target[target.length - 1] > source[source.length - 1];
}

export function applyMove(pegs: PegState, from: Peg, to: Peg): PegState {
  const next: PegState = { A: [...pegs.A], B: [...pegs.B], C: [...pegs.C] };
  next[to].push(next[from].pop() as number);
  return next;
}

export const isSolved = (pegs: PegState, discs: number) => pegs.C.length === discs;

/** Replays moves the way the server does. Returns null if a move is illegal. */
export function replayMoves(discs: number, moves: readonly string[]): boolean | null {
  let pegs = startingPegs(discs);
  let solved = false;
  for (const move of moves) {
    if (solved) return null;
    const from = move[0] as Peg;
    const to = move[1] as Peg;
    if (!canMove(pegs, from, to)) return null;
    pegs = applyMove(pegs, from, to);
    solved = isSolved(pegs, discs);
  }
  return solved;
}
