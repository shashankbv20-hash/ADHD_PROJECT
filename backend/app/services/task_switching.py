"""Task Switching: fixed trial list, event validation and event-derived metrics.

Each trial shows a coloured shape (red/blue circle/square) and a rule: sort by COLOUR or by SHAPE.
Left key: red (colour rule) or circle (shape rule). Right key: blue or square. On a *switch* trial the
rule differs from the previous trial; on a *repeat* trial it is the same. The first trial is neither.
The server derives the correct side and whether a trial is a switch from the rule sequence, so a browser
cannot relabel trials. Switch cost = mean correct reaction time on switch trials minus on repeat trials.
This is a research measurement, not a clinical assessment.
"""

from __future__ import annotations

from datetime import UTC, datetime
from statistics import mean
from typing import Any

from app.core.errors import ApiError
from app.schemas import TaskSwitchingEventInput

TASK_SWITCHING_CODE = "task-switching"
TASK_SWITCHING_CALCULATION_VERSION = "backend-task-switching-scoring-v1"
TASK_SWITCHING_DATA_PROVENANCE = "frontend-task-switching-demo-event-derived-v1"
RESPONSE_WINDOW_MS = 2200

# Rule: C = sort by colour, S = sort by shape. Colour: R red, B blue. Shape: O circle, Q square.
PRACTICE_RULES = "CCSSCCSS"
PRACTICE_COLOURS = "RBRBBBRR"
PRACTICE_SHAPES = "QOOOQQOQ"
SCORED_RULES = "CCSSCCSSCCSSSCCCSCSCSSCSSCCSSCCC"
SCORED_COLOURS = "BBRRRRBRRRBBBBRBBBRRBBBBRRRRRRBB"
SCORED_SHAPES = "OQQQQQOOOOQQOQOQOQQQOOQQQOOOQOOO"

RULE_NAMES = {"C": "colour", "S": "shape"}


def expected_trials(mode: str) -> tuple[tuple[str, str, str], ...]:
    """(rule name, colour, shape) per trial."""
    if mode == "practice":
        rules, colours, shapes = PRACTICE_RULES, PRACTICE_COLOURS, PRACTICE_SHAPES
    elif mode == "scored":
        rules, colours, shapes = SCORED_RULES, SCORED_COLOURS, SCORED_SHAPES
    else:
        raise ApiError(422, "unsupported_activity_mode", "The requested activity mode is unsupported.")
    return tuple((RULE_NAMES[r], c, s) for r, c, s in zip(rules, colours, shapes, strict=True))


def trial_count(mode: str) -> int:
    return len(expected_trials(mode))


def correct_side(rule: str, colour: str, shape: str) -> str:
    """Left = red / circle, right = blue / square."""
    if rule == "colour":
        return "L" if colour == "R" else "R"
    return "L" if shape == "O" else "R"


def trial_type(mode: str, index: int) -> str:
    """first, switch or repeat, from the rule sequence."""
    if index == 0:
        return "first"
    trials = expected_trials(mode)
    return "switch" if trials[index][0] != trials[index - 1][0] else "repeat"


def configuration_snapshot(mode: str) -> dict[str, Any]:
    def listing(m: str) -> list[dict[str, str]]:
        return [{"rule": r, "colour": c, "shape": s} for r, c, s in expected_trials(m)]

    return {
        "practice_trials": listing("practice"),
        "scored_trials": listing("scored"),
        "response_window_ms": RESPONSE_WINDOW_MS,
        "trial_index_base": 0,
        "configuration_version": "frontend-task-switching-config-v1",
        "stimuli": [f"{r}/{c}{s}" for r, c, s in expected_trials(mode)],
        "configuration_source": "frontend-task-switching-config-v1",
    }


def validate_task_switching_event(event: Any, mode: str) -> dict[str, Any]:
    if not isinstance(event, TaskSwitchingEventInput):
        raise ApiError(422, "invalid_task_switching_trial", "The trial is not a Task Switching trial.")
    trials = expected_trials(mode)
    if event.trial_index >= len(trials):
        raise ApiError(422, "trial_index_out_of_range", "A trial index is outside the configured sequence.")

    rule, colour, shape = trials[event.trial_index]
    if (
        event.trial_id != f"{TASK_SWITCHING_CODE}-{mode}-{event.trial_index + 1:02d}"
        or event.rule != rule
        or event.colour != colour
        or event.shape != shape
    ):
        raise ApiError(
            422, "invalid_task_switching_trial", "The trial does not match the configured sequence."
        )
    if event.responded and (event.reaction_time_ms is None or event.response_side is None):
        raise ApiError(422, "response_details_required", "A response needs a side and a reaction time.")
    if not event.responded and (event.reaction_time_ms is not None or event.response_side is not None):
        raise ApiError(422, "response_details_without_response", "No response cannot have a side or time.")

    if not event.responded:
        outcome = "omission"
    else:
        outcome = "correct" if event.response_side == correct_side(rule, colour, shape) else "error"

    return {
        "trial_index": event.trial_index,
        "trial_id": event.trial_id,
        "rule": rule,
        "colour": colour,
        "shape": shape,
        "trial_type": trial_type(mode, event.trial_index),
        "responded": event.responded,
        "response_side": event.response_side,
        "reaction_time_ms": event.reaction_time_ms,
        "outcome": outcome,
        # Event times are server-stamped; browser timestamps are not authoritative.
        "occurred_at": datetime.now(UTC),
    }


def _pct(part: int, whole: int) -> float | None:
    return round(part / whole * 100, 1) if whole else None


def calculate_task_switching_metrics(events: list[dict[str, Any]]) -> dict[str, Any]:
    if not events:
        raise ApiError(422, "no_activity_events", "At least one validated event is required.")

    switch = [e for e in events if e["trial_type"] == "switch"]
    repeat = [e for e in events if e["trial_type"] == "repeat"]

    def correct(group):
        return [e for e in group if e["outcome"] == "correct"]

    def mean_rt(group):
        rts = [float(e["reaction_time_ms"]) for e in correct(group)]
        return round(mean(rts)) if rts else None

    mean_switch, mean_repeat = mean_rt(switch), mean_rt(repeat)
    cost = mean_switch - mean_repeat if mean_switch is not None and mean_repeat is not None else None

    return {
        "trial_count": len(events),
        "switch_trial_count": len(switch),
        "repeat_trial_count": len(repeat),
        "correct_count": len(correct(events)),
        "error_count": sum(e["outcome"] == "error" for e in events),
        "omission_count": sum(e["outcome"] == "omission" for e in events),
        "accuracy_percent": _pct(len(correct(events)), len(events)),
        "switch_accuracy_percent": _pct(len(correct(switch)), len(switch)),
        "repeat_accuracy_percent": _pct(len(correct(repeat)), len(repeat)),
        "mean_switch_reaction_time_ms": mean_switch,
        "mean_repeat_reaction_time_ms": mean_repeat,
        "switch_cost_ms": cost,
        "data_provenance": TASK_SWITCHING_DATA_PROVENANCE,
        "calculation_version": TASK_SWITCHING_CALCULATION_VERSION,
    }
