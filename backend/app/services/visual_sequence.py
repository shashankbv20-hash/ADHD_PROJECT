"""Visual Sequence Memory: fixed sequences, response validation and event-derived metrics.

A 3x3 grid of squares (numbered 0-8, left to right, top to bottom) lights up one at a time. The child
then taps the squares in the same order. Each event is one trial: the cells the child tapped. The server
holds the sequences, so it decides whether the answer was exactly right and how many positions matched;
a browser cannot claim a longer span than it recalled. This is a research measurement, not a clinical
assessment.
"""

from __future__ import annotations

from datetime import UTC, datetime
from statistics import mean
from typing import Any

from app.core.errors import ApiError
from app.schemas import VisualSequenceEventInput

VISUAL_SEQUENCE_CODE = "visual-sequence"
VISUAL_SEQUENCE_CALCULATION_VERSION = "backend-visual-sequence-scoring-v1"
VISUAL_SEQUENCE_DATA_PROVENANCE = "frontend-visual-sequence-demo-event-derived-v1"

PRACTICE_SEQUENCES = ("26",)
SCORED_SEQUENCES = ("647", "378", "2830", "0561", "23067", "05871", "502107", "285672")


def expected_sequences(mode: str) -> tuple[tuple[int, ...], ...]:
    if mode == "practice":
        raw = PRACTICE_SEQUENCES
    elif mode == "scored":
        raw = SCORED_SEQUENCES
    else:
        raise ApiError(422, "unsupported_activity_mode", "The requested activity mode is unsupported.")
    return tuple(tuple(int(c) for c in s) for s in raw)


def trial_count(mode: str) -> int:
    return len(expected_sequences(mode))


def configuration_snapshot(mode: str) -> dict[str, Any]:
    return {
        "practice_sequences": [list(s) for s in expected_sequences("practice")],
        "scored_sequences": [list(s) for s in expected_sequences("scored")],
        "grid_cells": 9,
        "trial_index_base": 0,
        "configuration_version": "frontend-visual-sequence-config-v1",
        "stimuli": ["".join(map(str, s)) for s in expected_sequences(mode)],
        "configuration_source": "frontend-visual-sequence-config-v1",
    }


def validate_visual_sequence_event(event: Any, mode: str) -> dict[str, Any]:
    if not isinstance(event, VisualSequenceEventInput):
        raise ApiError(422, "invalid_visual_sequence_trial", "The trial is not a Visual Sequence trial.")
    sequences = expected_sequences(mode)
    if event.trial_index >= len(sequences):
        raise ApiError(422, "trial_index_out_of_range", "A trial index is outside the configured list.")

    sequence = sequences[event.trial_index]
    if (
        event.trial_id != f"{VISUAL_SEQUENCE_CODE}-{mode}-{event.trial_index + 1:02d}"
        or event.sequence_length != len(sequence)
    ):
        raise ApiError(422, "invalid_visual_sequence_trial", "The trial does not match the configured list.")
    if len(event.response) > len(sequence):
        raise ApiError(422, "response_too_long", "The response has more taps than the sequence.")
    if event.response and event.first_response_latency_ms is None:
        raise ApiError(422, "response_time_required", "A response needs a first-tap time.")
    if not event.response and event.first_response_latency_ms is not None:
        raise ApiError(422, "response_time_without_response", "A first-tap time needs at least one tap.")
    if (
        event.first_response_latency_ms is not None
        and event.first_response_latency_ms > event.total_response_time_ms
    ):
        raise ApiError(422, "invalid_response_times", "The first tap cannot come after the response ended.")

    response = list(event.response)
    matched = sum(1 for given, wanted in zip(response, sequence, strict=False) if given == wanted)
    return {
        "trial_index": event.trial_index,
        "trial_id": event.trial_id,
        "sequence_length": len(sequence),
        "response": response,
        "matched_positions": matched,
        "correct": response == list(sequence),
        "first_response_latency_ms": event.first_response_latency_ms,
        "total_response_time_ms": event.total_response_time_ms,
        # Event times are server-stamped; browser timestamps are not authoritative.
        "occurred_at": datetime.now(UTC),
    }


def _pct(part: int, whole: int) -> float | None:
    return round(part / whole * 100, 1) if whole else None


def calculate_visual_sequence_metrics(events: list[dict[str, Any]]) -> dict[str, Any]:
    if not events:
        raise ApiError(422, "no_activity_events", "At least one validated event is required.")

    correct = [e for e in events if e["correct"]]
    items = sum(e["sequence_length"] for e in events)
    latencies = [e["first_response_latency_ms"] for e in events if e["first_response_latency_ms"] is not None]

    return {
        "trial_count": len(events),
        "correct_count": len(correct),
        "accuracy_percent": _pct(len(correct), len(events)),
        "longest_correct_span": max((e["sequence_length"] for e in correct), default=None),
        "correct_position_percent": _pct(sum(e["matched_positions"] for e in events), items),
        "no_response_count": sum(not e["response"] for e in events),
        "mean_first_response_ms": round(mean(latencies)) if latencies else None,
        "data_provenance": VISUAL_SEQUENCE_DATA_PROVENANCE,
        "calculation_version": VISUAL_SEQUENCE_CALCULATION_VERSION,
    }
