"""Stop-Signal task: fixed trial sequence, event validation and event-derived metrics.

A trial shows a left or right arrow. On *go* trials the child presses the matching direction.
On *stop* trials a stop signal appears after a short delay (the stop-signal delay, SSD) and the
child must hold back. The SSD is adapted by the browser (staircase), so it is client-supplied but
strictly validated: whole 50 ms steps between 50 and 1000 ms, and only on stop trials.

SSRT is estimated with the *mean method* (mean go reaction time minus mean SSD). It is only reported
when the share of failed stops is between 25% and 75%, where the staircase estimate is usable.
This is a research measurement, not a clinical assessment.
"""

from __future__ import annotations

from datetime import UTC, datetime
from statistics import mean, pstdev
from typing import Any

from app.core.errors import ApiError
from app.schemas import StopSignalEventInput

STOP_SIGNAL_CODE = "stop-signal"
STOP_SIGNAL_CALCULATION_VERSION = "backend-stop-signal-scoring-v1"
STOP_SIGNAL_DATA_PROVENANCE = "frontend-stop-signal-demo-event-derived-v1"

# Direction of the arrow per trial, and trial type ("g" = go, "s" = stop; two stops per block of 8).
PRACTICE_DIRECTIONS = tuple("LRLRRLRL")
PRACTICE_TYPES = tuple("gggsggsg")
SCORED_DIRECTIONS = tuple("LRRLLRLRRLRLRRLLLLRLRLRRRRLRLLRL")
SCORED_TYPES = tuple("gggsggsgggsgggsggggsgsggggsggsgg")

SSD_MIN_MS, SSD_MAX_MS, SSD_STEP_MS = 50, 1000, 50
RESPONSE_WINDOW_MS = 2200
MIN_STOPS_FOR_SSRT = 4


def expected_trials(mode: str) -> tuple[tuple[str, bool], ...]:
    """(arrow direction, is_stop) for every trial of the mode."""
    if mode == "practice":
        directions, types = PRACTICE_DIRECTIONS, PRACTICE_TYPES
    elif mode == "scored":
        directions, types = SCORED_DIRECTIONS, SCORED_TYPES
    else:
        raise ApiError(422, "unsupported_activity_mode", "The requested activity mode is unsupported.")
    return tuple((d, t == "s") for d, t in zip(directions, types, strict=True))


def expected_directions(mode: str) -> tuple[str, ...]:
    return tuple(direction for direction, _ in expected_trials(mode))


def configuration_snapshot(mode: str) -> dict[str, Any]:
    return {
        "practice_trials": [{"direction": d, "is_stop": s} for d, s in expected_trials("practice")],
        "scored_trials": [{"direction": d, "is_stop": s} for d, s in expected_trials("scored")],
        "response_window_ms": RESPONSE_WINDOW_MS,
        "ssd_min_ms": SSD_MIN_MS,
        "ssd_max_ms": SSD_MAX_MS,
        "ssd_step_ms": SSD_STEP_MS,
        "trial_index_base": 0,
        "configuration_version": "frontend-stop-signal-config-v1",
        "stimuli": list(expected_directions(mode)),
        "configuration_source": "frontend-stop-signal-config-v1",
    }


def outcome_for(is_stop: bool, stimulus: str, responded: bool, direction: str | None) -> str:
    if is_stop:
        return "failed-stop" if responded else "successful-stop"
    if not responded:
        return "omission"
    return "correct" if direction == stimulus else "wrong-direction"


def validate_stop_signal_event(event: Any, mode: str) -> dict[str, Any]:
    if not isinstance(event, StopSignalEventInput):
        raise ApiError(422, "invalid_stop_signal_trial", "The trial is not a Stop-Signal trial.")
    trials = expected_trials(mode)
    if event.trial_index >= len(trials):
        raise ApiError(422, "trial_index_out_of_range", "A trial index is outside the configured sequence.")

    direction, is_stop = trials[event.trial_index]
    if (
        event.trial_id != f"{STOP_SIGNAL_CODE}-{mode}-{event.trial_index + 1:02d}"
        or event.stimulus != direction
        or event.is_stop != is_stop
    ):
        raise ApiError(422, "invalid_stop_signal_trial", "The trial does not match the configured sequence.")

    if is_stop:
        ssd = event.stop_signal_delay_ms
        if ssd is None or not SSD_MIN_MS <= ssd <= SSD_MAX_MS or ssd % SSD_STEP_MS != 0:
            raise ApiError(
                422,
                "invalid_stop_signal_delay",
                "A stop trial needs a stop-signal delay of 50 to 1000 ms in 50 ms steps.",
            )
    elif event.stop_signal_delay_ms is not None:
        raise ApiError(422, "invalid_stop_signal_delay", "Only stop trials have a stop-signal delay.")

    if event.responded and (event.reaction_time_ms is None or event.response_direction is None):
        raise ApiError(422, "response_details_required", "A response needs a direction and a reaction time.")
    if not event.responded and (event.reaction_time_ms is not None or event.response_direction is not None):
        raise ApiError(
            422, "response_details_without_response", "No response cannot have a direction or time."
        )

    return {
        "trial_index": event.trial_index,
        "trial_id": event.trial_id,
        "stimulus": direction,
        "is_stop": is_stop,
        "stop_signal_delay_ms": event.stop_signal_delay_ms,
        "responded": event.responded,
        "response_direction": event.response_direction,
        "reaction_time_ms": event.reaction_time_ms,
        "outcome": outcome_for(is_stop, direction, event.responded, event.response_direction),
        # Event times are server-stamped; browser timestamps are not authoritative.
        "occurred_at": datetime.now(UTC),
    }


def _pct(part: int, whole: int) -> float | None:
    return round(part / whole * 100, 1) if whole else None


def calculate_stop_signal_metrics(events: list[dict[str, Any]]) -> dict[str, Any]:
    if not events:
        raise ApiError(422, "no_activity_events", "At least one validated event is required.")

    go = [e for e in events if not e["is_stop"]]
    stops = [e for e in events if e["is_stop"]]
    correct = [e for e in go if e["outcome"] == "correct"]
    successful = [e for e in stops if e["outcome"] == "successful-stop"]
    failed = [e for e in stops if e["outcome"] == "failed-stop"]

    go_rts = [float(e["reaction_time_ms"]) for e in correct]
    ssds = [float(e["stop_signal_delay_ms"]) for e in stops]
    failed_share = len(failed) / len(stops) if stops else None

    ssrt_reliable = (
        failed_share is not None
        and len(stops) >= MIN_STOPS_FOR_SSRT
        and 0.25 <= failed_share <= 0.75
        and bool(go_rts)
    )
    ssrt = round(mean(go_rts) - mean(ssds)) if ssrt_reliable else None

    return {
        "trial_count": len(events),
        "go_trial_count": len(go),
        "stop_trial_count": len(stops),
        "go_correct_count": len(correct),
        "go_wrong_direction_count": sum(e["outcome"] == "wrong-direction" for e in go),
        "go_omission_count": sum(e["outcome"] == "omission" for e in go),
        "go_accuracy_percent": _pct(len(correct), len(go)),
        "mean_go_reaction_time_ms": round(mean(go_rts)) if go_rts else None,
        "go_reaction_time_stddev_ms": round(pstdev(go_rts), 1) if len(go_rts) > 1 else None,
        "successful_stop_count": len(successful),
        "failed_stop_count": len(failed),
        "stop_success_rate_percent": _pct(len(successful), len(stops)),
        "mean_stop_signal_delay_ms": round(mean(ssds)) if ssds else None,
        "ssrt_estimate_ms": ssrt,
        "ssrt_reliable": ssrt_reliable,
        "data_provenance": STOP_SIGNAL_DATA_PROVENANCE,
        "calculation_version": STOP_SIGNAL_CALCULATION_VERSION,
    }
