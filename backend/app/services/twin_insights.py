"""Digital Twin v2 insights, derived only from stored CPT summary metrics.

Everything here is descriptive. Each insight states how much data stands behind it, and
returns ``None`` (rather than a number) when there is not enough data to say anything.
Nothing here is a diagnosis, a prediction or a learned model.
"""

from __future__ import annotations

from statistics import mean
from typing import Any

# Number of saved runs needed before a trend or comparison is shown, and the confidence band.
MIN_RUNS_FOR_TREND = 2
MIN_RUNS_FOR_FATIGUE = 2
# Fewer valid hit reaction times than this in one run makes its spread too noisy to report.
MIN_HITS_FOR_SPREAD = 3
# A block with fewer trials than this is too small to compare.
MIN_TRIALS_PER_BLOCK = 4


def confidence_level(run_count: int) -> str:
    if run_count < MIN_RUNS_FOR_TREND:
        return "insufficient"
    if run_count < 5:
        return "low"
    if run_count < 10:
        return "moderate"
    return "higher"


def _num(value: Any) -> float | None:
    return float(value) if isinstance(value, int | float) and not isinstance(value, bool) else None


def _round(value: float | None, places: int = 1) -> float | None:
    return None if value is None else round(value, places)


def run_trend(metrics_list: list[dict[str, Any]], stamps: list[str]) -> list[dict[str, Any]]:
    """Per-run series, oldest first: accuracy, mean hit RT and its spread (SD, CV)."""
    series = []
    for index, (metrics, stamp) in enumerate(zip(metrics_list, stamps, strict=True), start=1):
        mean_rt = _num(metrics.get("mean_hit_reaction_time_ms"))
        stddev = _num(metrics.get("hit_reaction_time_stddev_ms"))
        hits = int(metrics.get("valid_reaction_time_count") or 0)
        spread_ok = stddev is not None and hits >= MIN_HITS_FOR_SPREAD
        series.append(
            {
                "run": index,
                "completed_at": stamp,
                "accuracy_percent": _num(metrics.get("accuracy_percent")),
                "mean_hit_reaction_time_ms": mean_rt,
                "reaction_time_sd_ms": _round(stddev, 1) if spread_ok else None,
                "reaction_time_cv": _round(stddev / mean_rt, 3) if spread_ok and mean_rt else None,
                "omission_errors": int(metrics.get("omission_error_count") or 0),
                "commission_errors": int(metrics.get("commission_error_count") or 0),
            }
        )
    return series


def block_profile(metrics_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Average of each block position across runs (block 1 = the start of a run)."""
    by_block: dict[int, list[dict[str, Any]]] = {}
    for metrics in metrics_list:
        for block in metrics.get("block_metrics") or []:
            if int(block.get("trial_count") or 0) >= MIN_TRIALS_PER_BLOCK:
                by_block.setdefault(int(block["block"]), []).append(block)

    profile = []
    for block_id in sorted(by_block):
        blocks = by_block[block_id]
        accuracies = [v for b in blocks if (v := _num(b.get("accuracy_percent"))) is not None]
        rts = [v for b in blocks if (v := _num(b.get("mean_hit_reaction_time_ms"))) is not None]
        profile.append(
            {
                "block": block_id,
                "runs": len(blocks),
                "accuracy_percent": _round(mean(accuracies)) if accuracies else None,
                "mean_hit_reaction_time_ms": _round(mean(rts)) if rts else None,
            }
        )
    return profile


def within_session_change(metrics_list: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Last block minus first block inside each run, averaged over runs.

    A positive reaction-time change and a negative accuracy change are consistent with fatigue
    or waning attention, but a short task with few trials per block can only suggest it.
    """
    accuracy_changes: list[float] = []
    rt_changes: list[float] = []
    runs_used = 0
    for metrics in metrics_list:
        blocks = [
            b
            for b in (metrics.get("block_metrics") or [])
            if int(b.get("trial_count") or 0) >= MIN_TRIALS_PER_BLOCK
        ]
        if len(blocks) < 2:
            continue
        blocks.sort(key=lambda b: int(b["block"]))
        first, last = blocks[0], blocks[-1]
        runs_used += 1
        a0, a1 = _num(first.get("accuracy_percent")), _num(last.get("accuracy_percent"))
        r0, r1 = _num(first.get("mean_hit_reaction_time_ms")), _num(last.get("mean_hit_reaction_time_ms"))
        if a0 is not None and a1 is not None:
            accuracy_changes.append(a1 - a0)
        if r0 is not None and r1 is not None:
            rt_changes.append(r1 - r0)

    if runs_used < MIN_RUNS_FOR_FATIGUE:
        return None
    return {
        "runs_used": runs_used,
        "accuracy_change_points": _round(mean(accuracy_changes)) if accuracy_changes else None,
        "reaction_time_change_ms": _round(mean(rt_changes)) if rt_changes else None,
        "note": "Last block minus first block within each run, averaged over runs.",
    }


def reaction_time_spread(series: list[dict[str, Any]]) -> dict[str, Any] | None:
    sds = [row["reaction_time_sd_ms"] for row in series if row["reaction_time_sd_ms"] is not None]
    cvs = [row["reaction_time_cv"] for row in series if row["reaction_time_cv"] is not None]
    if not sds:
        return None
    return {
        "runs_used": len(sds),
        "mean_sd_ms": _round(mean(sds)),
        "mean_cv": _round(mean(cvs), 3) if cvs else None,
    }


def twin_v2_insights(metrics_list: list[dict[str, Any]], stamps: list[str]) -> dict[str, Any]:
    series = run_trend(metrics_list, stamps)
    count = len(metrics_list)
    return {
        "confidence": confidence_level(count),
        "run_count": count,
        "trend": series if count >= MIN_RUNS_FOR_TREND else [],
        "block_profile": block_profile(metrics_list),
        "reaction_time_spread": reaction_time_spread(series),
        "within_session_change": within_session_change(metrics_list),
    }
