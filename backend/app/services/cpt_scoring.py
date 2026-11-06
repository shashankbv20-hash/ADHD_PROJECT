from __future__ import annotations

from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

import numpy as np
import pandas as pd

from app.core.errors import ApiError
from app.schemas import CptEventInput

CPT_PRACTICE_STIMULI = ("A", "X", "B", "C", "X", "D")
CPT_SCORED_STIMULI = (
    "A",
    "X",
    "B",
    "C",
    "D",
    "X",
    "B",
    "A",
    "X",
    "C",
    "D",
    "B",
    "X",
    "A",
    "C",
    "D",
    "X",
    "B",
    "A",
    "C",
    "D",
    "X",
    "B",
    "A",
)
CPT_RESPONSE_WINDOW_MS = 1200
CPT_CALCULATION_VERSION = "backend-cpt-scoring-v1"
CPT_DATA_PROVENANCE = "frontend-cpt-demo-event-derived-v1"


def _round_half_up(value: float, places: int = 0) -> int | float:
    quantum = Decimal(1).scaleb(-places)
    rounded = Decimal(str(value)).quantize(quantum, rounding=ROUND_HALF_UP)
    return int(rounded) if places == 0 else float(rounded)


def expected_stimuli(mode: str) -> tuple[str, ...]:
    if mode == "practice":
        return CPT_PRACTICE_STIMULI
    if mode == "scored":
        return CPT_SCORED_STIMULI
    raise ApiError(422, "unsupported_activity_mode", "The requested CPT mode is unsupported.")


def expected_outcome(is_target: bool, responded: bool) -> str:
    if is_target:
        return "hit" if responded else "miss"
    return "false-alarm" if responded else "correct-rejection"


def validate_cpt_event(event: CptEventInput, mode: str) -> dict[str, Any]:
    stimuli = expected_stimuli(mode)
    if event.trial_index >= len(stimuli):
        raise ApiError(
            422, "trial_index_out_of_range", "A CPT trial index is outside the configured sequence."
        )

    expected_stimulus = stimuli[event.trial_index]
    expected_target = expected_stimulus == "X"
    expected_trial_id = f"cpt-{mode}-{event.trial_index + 1:02d}"
    outcome = expected_outcome(expected_target, event.responded)

    if (
        event.trial_id != expected_trial_id
        or event.stimulus != expected_stimulus
        or event.is_target != expected_target
    ):
        raise ApiError(422, "invalid_cpt_trial", "The trial does not match the configured CPT sequence.")
    if event.responded and event.reaction_time_ms is None:
        raise ApiError(422, "reaction_time_required", "A response requires a reaction time.")
    if not event.responded and event.reaction_time_ms is not None:
        raise ApiError(
            422, "reaction_time_without_response", "A missed response cannot include a reaction time."
        )
    if event.outcome is not None and event.outcome != outcome:
        raise ApiError(
            422, "invalid_cpt_outcome", "The submitted outcome does not match the response and target."
        )

    return {
        "trial_index": event.trial_index,
        "trial_id": expected_trial_id,
        "stimulus": expected_stimulus,
        "is_target": expected_target,
        "responded": event.responded,
        "reaction_time_ms": event.reaction_time_ms,
        "outcome": outcome,
        # Event times are server-stamped. Browser-supplied timestamps are not
        # accepted as authoritative session chronology.
        "occurred_at": datetime.now(UTC),
    }


def calculate_cpt_metrics(events: list[dict[str, Any]]) -> dict[str, Any]:
    if not events:
        raise ApiError(422, "no_activity_events", "At least one validated CPT event is required.")

    frame = pd.DataFrame(events)
    target = frame["is_target"]
    responded = frame["responded"]
    outcome = frame["outcome"]
    hit = outcome == "hit"
    miss = outcome == "miss"
    false_alarm = outcome == "false-alarm"
    correct_rejection = outcome == "correct-rejection"
    hit_reaction_times = frame.loc[hit & frame["reaction_time_ms"].notna(), "reaction_time_ms"].to_numpy(
        dtype=float
    )

    reaction_total = float(np.sum(hit_reaction_times)) if hit_reaction_times.size else 0.0
    reaction_mean = float(np.mean(hit_reaction_times)) if hit_reaction_times.size else None
    reaction_stddev = float(np.std(hit_reaction_times, ddof=0)) if hit_reaction_times.size else None
    trial_count = len(frame)
    correct_count = int(hit.sum() + correct_rejection.sum())

    frame = frame.assign(
        is_correct=(hit | correct_rejection),
        hit_rt=np.where(hit, frame["reaction_time_ms"], np.nan),
        block=(frame["trial_index"] // 8) + 1,
    )
    blocks: list[dict[str, Any]] = []
    for block_id, block in frame.groupby("block", sort=True):
        block_rts = block["hit_rt"].dropna().to_numpy(dtype=float)
        block_count = len(block)
        blocks.append(
            {
                "block": int(block_id),
                "trial_count": block_count,
                "accuracy_percent": _round_half_up(float(block["is_correct"].sum()) / block_count * 100, 2),
                "mean_hit_reaction_time_ms": _round_half_up(float(np.mean(block_rts)))
                if block_rts.size
                else None,
            }
        )

    return {
        "trial_count": trial_count,
        "target_count": int(target.sum()),
        "non_target_count": int((~target).sum()),
        "response_count": int(responded.sum()),
        "hit_count": int(hit.sum()),
        "miss_count": int(miss.sum()),
        "false_alarm_count": int(false_alarm.sum()),
        "correct_rejection_count": int(correct_rejection.sum()),
        "accuracy_percent": _round_half_up(correct_count / trial_count * 100),
        "mean_hit_reaction_time_ms": _round_half_up(reaction_mean) if reaction_mean is not None else None,
        "hit_reaction_time_stddev_ms": _round_half_up(reaction_stddev, 2)
        if reaction_stddev is not None
        else None,
        "hit_reaction_time_total_ms": int(reaction_total),
        "valid_reaction_time_count": int(hit_reaction_times.size),
        "omission_error_count": int(miss.sum()),
        "commission_error_count": int(false_alarm.sum()),
        "block_metrics": blocks,
        "data_provenance": CPT_DATA_PROVENANCE,
        "calculation_version": CPT_CALCULATION_VERSION,
    }


def aggregate_cpt_summaries(summaries: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not summaries:
        return None
    count_fields = (
        "trial_count",
        "target_count",
        "non_target_count",
        "response_count",
        "hit_count",
        "miss_count",
        "false_alarm_count",
        "correct_rejection_count",
        "valid_reaction_time_count",
        "omission_error_count",
        "commission_error_count",
    )
    totals = {key: sum(int(item.get(key, 0)) for item in summaries) for key in count_fields}
    total_trials = totals["trial_count"]
    weighted_rt = sum(float(item.get("hit_reaction_time_total_ms", 0)) for item in summaries)
    valid_rt_count = totals["valid_reaction_time_count"]
    totals.update(
        {
            "accuracy_percent": _round_half_up(
                (totals["hit_count"] + totals["correct_rejection_count"]) / total_trials * 100
            )
            if total_trials
            else None,
            "mean_hit_reaction_time_ms": _round_half_up(weighted_rt / valid_rt_count)
            if valid_rt_count
            else None,
            "hit_reaction_time_total_ms": int(weighted_rt),
            "summary_count": len(summaries),
            "data_provenance": "backend-aggregate-cpt-summary-v1",
        }
    )
    return totals
