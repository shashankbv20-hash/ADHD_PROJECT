"""Multiple Object Tracking: fixed target sets, selection validation and event-derived metrics.

Eight circles move around the screen. A few (the targets) are marked at the start, then every circle looks
the same while they all keep moving. When they stop, the child taps the circles they were tracking. The
circles are numbered 0-7; the server holds which numbers are targets in each trial and derives the hits,
wrong picks and whether the trial was perfect, so a browser cannot claim a correct answer. This is a
research measurement, not a clinical assessment.
"""

from __future__ import annotations

from datetime import UTC, datetime
from statistics import mean
from typing import Any

from app.core.errors import ApiError
from app.schemas import ObjectTrackingEventInput

OBJECT_TRACKING_CODE = "multiple-object-tracking"
OBJECT_TRACKING_CALCULATION_VERSION = "backend-object-tracking-scoring-v1"
OBJECT_TRACKING_DATA_PROVENANCE = "frontend-object-tracking-demo-event-derived-v1"
OBJECT_COUNT = 8

# Target circle numbers per trial.
PRACTICE_TARGETS = ("01",)
SCORED_TARGETS = ("02", "35", "147", "062", "1356", "0247")


def expected_targets(mode: str) -> tuple[frozenset[int], ...]:
    if mode == "practice":
        raw = PRACTICE_TARGETS
    elif mode == "scored":
        raw = SCORED_TARGETS
    else:
        raise ApiError(422, "unsupported_activity_mode", "The requested activity mode is unsupported.")
    return tuple(frozenset(int(c) for c in s) for s in raw)


def trial_count(mode: str) -> int:
    return len(expected_targets(mode))


def configuration_snapshot(mode: str) -> dict[str, Any]:
    return {
        "practice_targets": [sorted(t) for t in expected_targets("practice")],
        "scored_targets": [sorted(t) for t in expected_targets("scored")],
        "object_count": OBJECT_COUNT,
        "trial_index_base": 0,
        "configuration_version": "frontend-object-tracking-config-v1",
        "stimuli": [f"{len(t)} of {OBJECT_COUNT}" for t in expected_targets(mode)],
        "configuration_source": "frontend-object-tracking-config-v1",
    }


def validate_object_tracking_event(event: Any, mode: str) -> dict[str, Any]:
    if not isinstance(event, ObjectTrackingEventInput):
        raise ApiError(422, "invalid_object_tracking_trial", "The trial is not an Object Tracking trial.")
    all_targets = expected_targets(mode)
    if event.trial_index >= len(all_targets):
        raise ApiError(422, "trial_index_out_of_range", "A trial index is outside the configured list.")

    targets = all_targets[event.trial_index]
    if (
        event.trial_id != f"{OBJECT_TRACKING_CODE}-{mode}-{event.trial_index + 1:02d}"
        or event.object_count != OBJECT_COUNT
        or event.target_count != len(targets)
    ):
        raise ApiError(422, "invalid_object_tracking_trial", "The trial does not match the configured list.")
    selected = list(event.selected)
    if len(set(selected)) != len(selected) or len(selected) > len(targets):
        raise ApiError(
            422, "invalid_selection", "Select each circle at most once, and no more than the targets."
        )
    if selected and event.response_time_ms is None:
        raise ApiError(422, "response_time_required", "A selection needs a response time.")
    if not selected and event.response_time_ms is not None:
        raise ApiError(
            422, "response_time_without_selection", "A response time needs at least one selection."
        )

    hits = len(set(selected) & targets)
    return {
        "trial_index": event.trial_index,
        "trial_id": event.trial_id,
        "object_count": OBJECT_COUNT,
        "target_count": len(targets),
        "selected": selected,
        "hits": hits,
        "wrong_picks": len(selected) - hits,
        "perfect": hits == len(targets) and len(selected) == len(targets),
        "response_time_ms": event.response_time_ms,
        # Event times are server-stamped; browser timestamps are not authoritative.
        "occurred_at": datetime.now(UTC),
    }


def _pct(part: int, whole: int) -> float | None:
    return round(part / whole * 100, 1) if whole else None


def calculate_object_tracking_metrics(events: list[dict[str, Any]]) -> dict[str, Any]:
    if not events:
        raise ApiError(422, "no_activity_events", "At least one validated event is required.")

    perfect = [e for e in events if e["perfect"]]
    by_load = []
    for load in sorted({e["target_count"] for e in events}):
        group = [e for e in events if e["target_count"] == load]
        by_load.append(
            {
                "target_count": load,
                "trial_count": len(group),
                "targets_found_percent": _pct(sum(e["hits"] for e in group), load * len(group)),
            }
        )
    times = [e["response_time_ms"] for e in events if e["response_time_ms"] is not None]

    return {
        "trial_count": len(events),
        "perfect_count": len(perfect),
        "perfect_percent": _pct(len(perfect), len(events)),
        "targets_found_percent": _pct(sum(e["hits"] for e in events), sum(e["target_count"] for e in events)),
        "wrong_pick_count": sum(e["wrong_picks"] for e in events),
        "highest_perfect_load": max((e["target_count"] for e in perfect), default=None),
        "by_load": by_load,
        "mean_response_time_ms": round(mean(times)) if times else None,
        "data_provenance": OBJECT_TRACKING_DATA_PROVENANCE,
        "calculation_version": OBJECT_TRACKING_CALCULATION_VERSION,
    }
