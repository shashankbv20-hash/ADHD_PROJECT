"""Time Perception: fixed durations, reproduction validation and event-derived metrics.

A circle is shown for a target duration. The child then reproduces that duration by pressing Start and
Stop. The server holds the target durations and derives the error (reproduced minus target), the ratio and
whether it was within 20% of the target, so a browser cannot claim a better estimate than it made.
Reproduction error is the research signal here; this is not a clinical assessment.
"""

from __future__ import annotations

from datetime import UTC, datetime
from statistics import mean, pstdev
from typing import Any

from app.core.errors import ApiError
from app.schemas import TimePerceptionEventInput

TIME_PERCEPTION_CODE = "time-perception"
TIME_PERCEPTION_CALCULATION_VERSION = "backend-time-perception-scoring-v1"
TIME_PERCEPTION_DATA_PROVENANCE = "frontend-time-perception-demo-event-derived-v1"
WITHIN_FRACTION = 0.2

PRACTICE_TARGETS_MS = (2000,)
SCORED_TARGETS_MS = (3000, 1500, 4500, 2000, 3500, 1000, 4000, 2500)


def expected_targets(mode: str) -> tuple[int, ...]:
    if mode == "practice":
        return PRACTICE_TARGETS_MS
    if mode == "scored":
        return SCORED_TARGETS_MS
    raise ApiError(422, "unsupported_activity_mode", "The requested activity mode is unsupported.")


def trial_count(mode: str) -> int:
    return len(expected_targets(mode))


def configuration_snapshot(mode: str) -> dict[str, Any]:
    return {
        "practice_targets_ms": list(PRACTICE_TARGETS_MS),
        "scored_targets_ms": list(SCORED_TARGETS_MS),
        "within_fraction": WITHIN_FRACTION,
        "trial_index_base": 0,
        "configuration_version": "frontend-time-perception-config-v1",
        "stimuli": [f"{t} ms" for t in expected_targets(mode)],
        "configuration_source": "frontend-time-perception-config-v1",
    }


def validate_time_perception_event(event: Any, mode: str) -> dict[str, Any]:
    if not isinstance(event, TimePerceptionEventInput):
        raise ApiError(422, "invalid_time_perception_trial", "The trial is not a Time Perception trial.")
    targets = expected_targets(mode)
    if event.trial_index >= len(targets):
        raise ApiError(422, "trial_index_out_of_range", "A trial index is outside the configured list.")

    target = targets[event.trial_index]
    if (
        event.trial_id != f"{TIME_PERCEPTION_CODE}-{mode}-{event.trial_index + 1:02d}"
        or event.target_ms != target
    ):
        raise ApiError(422, "invalid_time_perception_trial", "The trial does not match the configured list.")

    reproduced = event.reproduced_ms
    return {
        "trial_index": event.trial_index,
        "trial_id": event.trial_id,
        "target_ms": target,
        "reproduced_ms": reproduced,
        "responded": reproduced is not None,
        "error_ms": None if reproduced is None else reproduced - target,
        "ratio": None if reproduced is None else round(reproduced / target, 3),
        "within_tolerance": None
        if reproduced is None
        else abs(reproduced - target) <= WITHIN_FRACTION * target,
        # Event times are server-stamped; browser timestamps are not authoritative.
        "occurred_at": datetime.now(UTC),
    }


def calculate_time_perception_metrics(events: list[dict[str, Any]]) -> dict[str, Any]:
    if not events:
        raise ApiError(422, "no_activity_events", "At least one validated event is required.")

    answered = [e for e in events if e["responded"]]
    ratios = [e["ratio"] for e in answered]
    errors = [e["error_ms"] for e in answered]

    return {
        "trial_count": len(events),
        "response_count": len(answered),
        "no_response_count": len(events) - len(answered),
        "mean_absolute_error_ms": round(mean(abs(x) for x in errors)) if errors else None,
        "mean_signed_error_ms": round(mean(errors)) if errors else None,
        "mean_ratio": round(mean(ratios), 2) if ratios else None,
        "ratio_variability": round(pstdev(ratios), 2) if len(ratios) >= 2 else None,
        "within_tolerance_count": sum(bool(e["within_tolerance"]) for e in answered),
        "within_tolerance_percent": (
            round(sum(bool(e["within_tolerance"]) for e in answered) / len(events) * 100, 1)
        ),
        "data_provenance": TIME_PERCEPTION_DATA_PROVENANCE,
        "calculation_version": TIME_PERCEPTION_CALCULATION_VERSION,
    }
