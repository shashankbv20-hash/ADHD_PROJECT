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
# Go/No-Go: "G" (go) requires a response, "N" (no-go) requires withholding it. Scoring reuses the
# CPT outcome model (hit / miss = omission / false alarm = commission / correct rejection).
GO_NO_GO_CODE = "go-no-go"
GO_NO_GO_PRACTICE_STIMULI = tuple("GGNGGGNG")
GO_NO_GO_SCORED_STIMULI = tuple("GGNGGGNGGNGGGNGGGGGNGGNGNGGGNGGG")
GO_NO_GO_CALCULATION_VERSION = "backend-go-no-go-scoring-v1"
GO_NO_GO_DATA_PROVENANCE = "frontend-go-no-go-demo-event-derived-v1"

# N-back: the child presses when the letter matches the one N trials earlier. Practice is 1-back only.
# A scored run is 16 trials of 1-back followed by 16 trials of 2-back; matching restarts at each level,
# so the first N trials of a level can never be targets. The server derives every trial's target status
# from the letters, so a browser cannot claim a different answer key.
N_BACK_CODE = "n-back"
N_BACK_PRACTICE_STIMULI = tuple("ABBCDDAC")
N_BACK_SCORED_STIMULI = tuple("KKMLLQKMMQFFKLQKLQLMKMFQFKLKQDMQ")
N_BACK_LEVEL_LENGTH = 16  # scored: trials 0-15 are 1-back, 16-31 are 2-back
N_BACK_CALCULATION_VERSION = "backend-n-back-scoring-v1"
N_BACK_DATA_PROVENANCE = "frontend-n-back-demo-event-derived-v1"

CPT_RESPONSE_WINDOW_MS = 2200
CPT_CALCULATION_VERSION = "backend-cpt-scoring-v1"
CPT_DATA_PROVENANCE = "frontend-cpt-demo-event-derived-v1"


def _round_half_up(value: float, places: int = 0) -> int | float:
    quantum = Decimal(1).scaleb(-places)
    rounded = Decimal(str(value)).quantize(quantum, rounding=ROUND_HALF_UP)
    return int(rounded) if places == 0 else float(rounded)


TARGET_STIMULUS = {"cpt": "X", GO_NO_GO_CODE: "G"}

# (data provenance, calculation version) stored with each activity's summary.
ACTIVITY_PROVENANCE = {
    "cpt": (CPT_DATA_PROVENANCE, CPT_CALCULATION_VERSION),
    GO_NO_GO_CODE: (GO_NO_GO_DATA_PROVENANCE, GO_NO_GO_CALCULATION_VERSION),
    N_BACK_CODE: (N_BACK_DATA_PROVENANCE, N_BACK_CALCULATION_VERSION),
}


def expected_stimuli(mode: str, activity_code: str = "cpt") -> tuple[str, ...]:
    if mode not in ("practice", "scored"):
        raise ApiError(422, "unsupported_activity_mode", "The requested activity mode is unsupported.")
    if activity_code == GO_NO_GO_CODE:
        return GO_NO_GO_PRACTICE_STIMULI if mode == "practice" else GO_NO_GO_SCORED_STIMULI
    if activity_code == N_BACK_CODE:
        return N_BACK_PRACTICE_STIMULI if mode == "practice" else N_BACK_SCORED_STIMULI
    return CPT_PRACTICE_STIMULI if mode == "practice" else CPT_SCORED_STIMULI


def expected_outcome(is_target: bool, responded: bool) -> str:
    if is_target:
        return "hit" if responded else "miss"
    return "false-alarm" if responded else "correct-rejection"


def n_back_level(mode: str, trial_index: int) -> int:
    """The N of the trial: practice is 1-back; scored is 1-back then 2-back."""
    return 1 if mode == "practice" or trial_index < N_BACK_LEVEL_LENGTH else 2


def _expected_target(activity_code: str, mode: str, index: int, stimuli: tuple[str, ...]) -> bool:
    if activity_code != N_BACK_CODE:
        return stimuli[index] == TARGET_STIMULUS[activity_code]
    n = n_back_level(mode, index)
    level_start = 0 if n_back_level(mode, index) == 1 else N_BACK_LEVEL_LENGTH
    return index - level_start >= n and stimuli[index] == stimuli[index - n]


def validate_cpt_event(event: CptEventInput, mode: str, activity_code: str = "cpt") -> dict[str, Any]:
    stimuli = expected_stimuli(mode, activity_code)
    if event.trial_index >= len(stimuli):
        raise ApiError(
            422, "trial_index_out_of_range", "A CPT trial index is outside the configured sequence."
        )

    expected_stimulus = stimuli[event.trial_index]
    expected_target = _expected_target(activity_code, mode, event.trial_index, stimuli)
    expected_trial_id = f"{activity_code}-{mode}-{event.trial_index + 1:02d}"
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


def calculate_activity_metrics(events: list[dict[str, Any]], activity_code: str = "cpt") -> dict[str, Any]:
    """Event-derived metrics for any response/withhold activity (CPT or Go/No-Go)."""
    metrics = calculate_cpt_metrics(events)
    provenance, version = ACTIVITY_PROVENANCE.get(activity_code, ACTIVITY_PROVENANCE["cpt"])
    metrics["data_provenance"] = provenance
    metrics["calculation_version"] = version
    return metrics


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
