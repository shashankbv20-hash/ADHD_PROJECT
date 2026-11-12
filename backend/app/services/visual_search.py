"""Visual Search: fixed trial list, event validation and event-derived metrics.

Each trial shows a grid of coloured letters. The target is a red T; distractors are blue Ts and red Ls
(a conjunction search). The child says whether the red T is present or absent. Grids have 4, 8 or 12
items. The server derives the correct answer and the grid size from the trial list, so a browser cannot
relabel a trial. The search slope is the extra reaction time per added item, fitted over correct trials.
This is a research measurement, not a clinical assessment.
"""

from __future__ import annotations

from datetime import UTC, datetime
from statistics import mean
from typing import Any

from app.core.errors import ApiError
from app.schemas import VisualSearchEventInput

VISUAL_SEARCH_CODE = "visual-search"
VISUAL_SEARCH_CALCULATION_VERSION = "backend-visual-search-scoring-v1"
VISUAL_SEARCH_DATA_PROVENANCE = "frontend-visual-search-demo-event-derived-v1"
RESPONSE_WINDOW_MS = 2200
SET_SIZES = {"S": 4, "M": 8, "L": 12}

# Size code per trial (S/M/L) and whether the target is present (1) or absent (0).
PRACTICE_SIZES = "SSMLML"
PRACTICE_PRESENT = "010011"
SCORED_SIZES = "LLMSMSMMSLLSLLSMLSMSMLLMMSSMSL"
SCORED_PRESENT = "010011001001110100110011000111"


def expected_trials(mode: str) -> tuple[tuple[int, bool], ...]:
    """(set size, target present) per trial."""
    if mode == "practice":
        sizes, present = PRACTICE_SIZES, PRACTICE_PRESENT
    elif mode == "scored":
        sizes, present = SCORED_SIZES, SCORED_PRESENT
    else:
        raise ApiError(422, "unsupported_activity_mode", "The requested activity mode is unsupported.")
    return tuple((SET_SIZES[s], p == "1") for s, p in zip(sizes, present, strict=True))


def trial_count(mode: str) -> int:
    return len(expected_trials(mode))


def configuration_snapshot(mode: str) -> dict[str, Any]:
    def listing(m: str) -> list[dict[str, Any]]:
        return [{"set_size": n, "target_present": p} for n, p in expected_trials(m)]

    return {
        "practice_trials": listing("practice"),
        "scored_trials": listing("scored"),
        "target": "red T",
        "distractors": ["blue T", "red L"],
        "response_window_ms": RESPONSE_WINDOW_MS,
        "trial_index_base": 0,
        "configuration_version": "frontend-visual-search-config-v1",
        "stimuli": [f"{n}/{'present' if p else 'absent'}" for n, p in expected_trials(mode)],
        "configuration_source": "frontend-visual-search-config-v1",
    }


def validate_visual_search_event(event: Any, mode: str) -> dict[str, Any]:
    if not isinstance(event, VisualSearchEventInput):
        raise ApiError(422, "invalid_visual_search_trial", "The trial is not a Visual Search trial.")
    trials = expected_trials(mode)
    if event.trial_index >= len(trials):
        raise ApiError(422, "trial_index_out_of_range", "A trial index is outside the configured sequence.")

    set_size, present = trials[event.trial_index]
    if (
        event.trial_id != f"{VISUAL_SEARCH_CODE}-{mode}-{event.trial_index + 1:02d}"
        or event.set_size != set_size
        or event.target_present != present
    ):
        raise ApiError(
            422, "invalid_visual_search_trial", "The trial does not match the configured sequence."
        )
    if event.responded and (event.reaction_time_ms is None or event.response is None):
        raise ApiError(422, "response_details_required", "A response needs an answer and a reaction time.")
    if not event.responded and (event.reaction_time_ms is not None or event.response is not None):
        raise ApiError(422, "response_details_without_response", "No response cannot have an answer or time.")

    if not event.responded:
        outcome = "omission"
    else:
        outcome = "correct" if (event.response == "present") == present else "error"

    return {
        "trial_index": event.trial_index,
        "trial_id": event.trial_id,
        "set_size": set_size,
        "target_present": present,
        "responded": event.responded,
        "response": event.response,
        "reaction_time_ms": event.reaction_time_ms,
        "outcome": outcome,
        # Event times are server-stamped; browser timestamps are not authoritative.
        "occurred_at": datetime.now(UTC),
    }


def _pct(part: int, whole: int) -> float | None:
    return round(part / whole * 100, 1) if whole else None


def _slope(points: list[tuple[int, float]]) -> float | None:
    """Least-squares slope of reaction time on set size; needs at least two distinct sizes."""
    if len({size for size, _ in points}) < 2:
        return None
    mx = mean(size for size, _ in points)
    my = mean(rt for _, rt in points)
    denominator = sum((size - mx) ** 2 for size, _ in points)
    return round(sum((size - mx) * (rt - my) for size, rt in points) / denominator, 1)


def calculate_visual_search_metrics(events: list[dict[str, Any]]) -> dict[str, Any]:
    if not events:
        raise ApiError(422, "no_activity_events", "At least one validated event is required.")

    present = [e for e in events if e["target_present"]]
    absent = [e for e in events if not e["target_present"]]

    def correct(group):
        return [e for e in group if e["outcome"] == "correct"]

    by_size = []
    for size in sorted(set(SET_SIZES.values())):
        rts = [float(e["reaction_time_ms"]) for e in correct(events) if e["set_size"] == size]
        by_size.append({"set_size": size, "mean_reaction_time_ms": round(mean(rts)) if rts else None})

    correct_rts = [float(e["reaction_time_ms"]) for e in correct(events)]
    # Slope uses present and absent trials separately: absent trials take longer by design.
    slope_present = _slope([(e["set_size"], float(e["reaction_time_ms"])) for e in correct(present)])

    return {
        "trial_count": len(events),
        "target_present_count": len(present),
        "target_absent_count": len(absent),
        "correct_count": len(correct(events)),
        "error_count": sum(e["outcome"] == "error" for e in events),
        "omission_count": sum(e["outcome"] == "omission" for e in events),
        "accuracy_percent": _pct(len(correct(events)), len(events)),
        "present_accuracy_percent": _pct(len(correct(present)), len(present)),
        "absent_accuracy_percent": _pct(len(correct(absent)), len(absent)),
        "mean_reaction_time_ms": round(mean(correct_rts)) if correct_rts else None,
        "reaction_time_by_set_size": by_size,
        "search_slope_ms_per_item": slope_present,
        "data_provenance": VISUAL_SEARCH_DATA_PROVENANCE,
        "calculation_version": VISUAL_SEARCH_CALCULATION_VERSION,
    }
