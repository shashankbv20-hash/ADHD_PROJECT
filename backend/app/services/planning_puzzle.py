"""Planning Puzzle (Tower of Hanoi): fixed puzzle list, move replay and event-derived metrics.

Three pegs (A, B, C). All discs start on A, smallest on top; the goal is to move them to C one disc at
a time, never placing a larger disc on a smaller one. Each event is one puzzle: the list of moves the
child made ("AB" = top disc from A to B). The server replays the moves itself, rejects an illegal move,
works out whether the puzzle was solved and how many moves it took against the minimum (2^n - 1), so a
browser cannot claim a solution it did not make. This is a research measurement, not a clinical assessment.
"""

from __future__ import annotations

from datetime import UTC, datetime
from statistics import mean
from typing import Any

from app.core.errors import ApiError
from app.schemas import PlanningPuzzleEventInput

PLANNING_PUZZLE_CODE = "planning-puzzle"
PLANNING_PUZZLE_CALCULATION_VERSION = "backend-planning-puzzle-scoring-v1"
PLANNING_PUZZLE_DATA_PROVENANCE = "frontend-planning-puzzle-demo-event-derived-v1"
PUZZLE_TIME_LIMIT_MS = 120_000

PRACTICE_DISCS = (3,)
SCORED_DISCS = (3, 3, 4)


def expected_puzzles(mode: str) -> tuple[int, ...]:
    if mode == "practice":
        return PRACTICE_DISCS
    if mode == "scored":
        return SCORED_DISCS
    raise ApiError(422, "unsupported_activity_mode", "The requested activity mode is unsupported.")


def trial_count(mode: str) -> int:
    return len(expected_puzzles(mode))


def minimum_moves(discs: int) -> int:
    return 2**discs - 1


def replay(discs: int, moves: list[str]) -> bool:
    """Apply the moves; raise on an illegal one. Returns True when all discs end on peg C."""
    pegs: dict[str, list[int]] = {"A": list(range(discs, 0, -1)), "B": [], "C": []}
    solved = False
    for number, move in enumerate(moves, start=1):
        if solved:
            raise ApiError(422, "moves_after_solution", "Moves were recorded after the puzzle was solved.")
        source, target = move[0], move[1]
        if source == target or not pegs[source]:
            raise ApiError(422, "illegal_move", f"Move {number} is not possible.")
        disc = pegs[source][-1]
        if pegs[target] and pegs[target][-1] < disc:
            raise ApiError(422, "illegal_move", f"Move {number} places a larger disc on a smaller one.")
        pegs[target].append(pegs[source].pop())
        solved = len(pegs["C"]) == discs
    return solved


def configuration_snapshot(mode: str) -> dict[str, Any]:
    return {
        "practice_puzzles": [{"discs": d} for d in expected_puzzles("practice")],
        "scored_puzzles": [{"discs": d} for d in expected_puzzles("scored")],
        "pegs": ["A", "B", "C"],
        "time_limit_ms": PUZZLE_TIME_LIMIT_MS,
        "trial_index_base": 0,
        "configuration_version": "frontend-planning-puzzle-config-v1",
        "stimuli": [f"{d} discs" for d in expected_puzzles(mode)],
        "configuration_source": "frontend-planning-puzzle-config-v1",
    }


def validate_planning_puzzle_event(event: Any, mode: str) -> dict[str, Any]:
    if not isinstance(event, PlanningPuzzleEventInput):
        raise ApiError(422, "invalid_planning_puzzle_trial", "The trial is not a Planning Puzzle.")
    puzzles = expected_puzzles(mode)
    if event.trial_index >= len(puzzles):
        raise ApiError(422, "trial_index_out_of_range", "A puzzle index is outside the configured list.")

    discs = puzzles[event.trial_index]
    if (
        event.trial_id != f"{PLANNING_PUZZLE_CODE}-{mode}-{event.trial_index + 1:02d}"
        or event.disc_count != discs
    ):
        raise ApiError(422, "invalid_planning_puzzle_trial", "The puzzle does not match the configured list.")
    if event.moves and event.first_move_latency_ms is None:
        raise ApiError(422, "first_move_time_required", "Moves need a first-move time.")
    if not event.moves and event.first_move_latency_ms is not None:
        raise ApiError(422, "first_move_time_without_moves", "A first-move time needs at least one move.")
    if event.first_move_latency_ms is not None and event.first_move_latency_ms > event.total_time_ms:
        raise ApiError(422, "invalid_puzzle_times", "The first move cannot come after the puzzle ended.")

    solved = replay(discs, list(event.moves))
    return {
        "trial_index": event.trial_index,
        "trial_id": event.trial_id,
        "disc_count": discs,
        "moves": list(event.moves),
        "move_count": len(event.moves),
        "illegal_attempts": event.illegal_attempts,
        "first_move_latency_ms": event.first_move_latency_ms,
        "total_time_ms": event.total_time_ms,
        "solved": solved,
        "minimum_moves": minimum_moves(discs),
        # Event times are server-stamped; browser timestamps are not authoritative.
        "occurred_at": datetime.now(UTC),
    }


def _pct(part: int, whole: int) -> float | None:
    return round(part / whole * 100, 1) if whole else None


def calculate_planning_puzzle_metrics(events: list[dict[str, Any]]) -> dict[str, Any]:
    if not events:
        raise ApiError(422, "no_activity_events", "At least one validated event is required.")

    solved = [e for e in events if e["solved"]]
    planning = [e["first_move_latency_ms"] for e in events if e["first_move_latency_ms"] is not None]
    extra = [e["move_count"] - e["minimum_moves"] for e in solved]

    return {
        "puzzle_count": len(events),
        "solved_count": len(solved),
        "solved_percent": _pct(len(solved), len(events)),
        "optimal_count": sum(e["move_count"] == e["minimum_moves"] for e in solved),
        "total_moves": sum(e["move_count"] for e in events),
        "mean_extra_moves": round(mean(extra), 1) if extra else None,
        "illegal_attempts": sum(e["illegal_attempts"] for e in events),
        "mean_planning_time_ms": round(mean(planning)) if planning else None,
        "mean_solution_time_ms": round(mean(e["total_time_ms"] for e in solved)) if solved else None,
        "data_provenance": PLANNING_PUZZLE_DATA_PROVENANCE,
        "calculation_version": PLANNING_PUZZLE_CALCULATION_VERSION,
    }
