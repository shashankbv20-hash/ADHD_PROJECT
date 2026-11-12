from app.services.digital_twin import build_twin_snapshot
from app.services.twin_insights import (
    block_profile,
    confidence_level,
    reaction_time_spread,
    run_trend,
    twin_v2_insights,
    within_session_change,
)


def metrics(accuracy=90, rt=400, sd=60.0, hits=5, blocks=None):
    return {
        "accuracy_percent": accuracy,
        "mean_hit_reaction_time_ms": rt,
        "hit_reaction_time_stddev_ms": sd,
        "valid_reaction_time_count": hits,
        "omission_error_count": 1,
        "commission_error_count": 0,
        "block_metrics": blocks
        if blocks is not None
        else [
            {"block": 1, "trial_count": 8, "accuracy_percent": 100, "mean_hit_reaction_time_ms": 380},
            {"block": 2, "trial_count": 8, "accuracy_percent": 87.5, "mean_hit_reaction_time_ms": 410},
            {"block": 3, "trial_count": 8, "accuracy_percent": 75, "mean_hit_reaction_time_ms": 450},
        ],
    }


STAMPS = ["2026-01-01T00:00:00+00:00", "2026-01-02T00:00:00+00:00", "2026-01-03T00:00:00+00:00"]


def test_confidence_bands():
    assert [confidence_level(n) for n in (0, 1, 2, 4, 5, 9, 10)] == [
        "insufficient",
        "insufficient",
        "low",
        "low",
        "moderate",
        "moderate",
        "higher",
    ]


def test_single_run_gives_no_trend_or_fatigue():
    insights = twin_v2_insights([metrics()], STAMPS[:1])
    assert insights["confidence"] == "insufficient"
    assert insights["trend"] == []
    assert insights["within_session_change"] is None
    # Block profile and spread are still descriptive for one run.
    assert len(insights["block_profile"]) == 3
    assert insights["reaction_time_spread"]["mean_sd_ms"] == 60.0


def test_within_session_change_is_last_minus_first_block():
    change = within_session_change([metrics(), metrics()])
    assert change["runs_used"] == 2
    assert change["accuracy_change_points"] == -25.0
    assert change["reaction_time_change_ms"] == 70.0


def test_spread_needs_enough_hits():
    series = run_trend([metrics(hits=2), metrics(hits=4, sd=40.0, rt=400)], STAMPS[:2])
    assert series[0]["reaction_time_sd_ms"] is None and series[0]["reaction_time_cv"] is None
    assert series[1]["reaction_time_sd_ms"] == 40.0 and series[1]["reaction_time_cv"] == 0.1
    assert reaction_time_spread(series)["runs_used"] == 1
    assert reaction_time_spread(run_trend([metrics(hits=1)], STAMPS[:1])) is None


def test_small_blocks_are_ignored():
    tiny = [{"block": 1, "trial_count": 2, "accuracy_percent": 50, "mean_hit_reaction_time_ms": None}]
    assert block_profile([metrics(blocks=tiny)]) == []
    assert within_session_change([metrics(blocks=tiny)] * 3) is None


def test_missing_reaction_times_do_not_crash():
    m = metrics(rt=None, sd=None, hits=0)
    series = run_trend([m, m], STAMPS[:2])
    assert series[0]["reaction_time_sd_ms"] is None
    assert twin_v2_insights([m, m], STAMPS[:2])["reaction_time_spread"] is None


def test_snapshot_embeds_insights():
    import datetime as dt

    summaries = [
        {
            "id": f"s{i}",
            "created_at": dt.datetime(2026, 1, i + 1, tzinfo=dt.UTC),
            "metrics": {
                **metrics(),
                "trial_count": 24,
                "target_count": 6,
                "non_target_count": 18,
                "response_count": 6,
                "hit_count": 5,
                "miss_count": 1,
                "false_alarm_count": 1,
                "correct_rejection_count": 17,
                "hit_reaction_time_total_ms": 2000,
            },
        }
        for i in range(3)
    ]
    snapshot = build_twin_snapshot(summaries)
    assert snapshot["status"] == "available"
    assert snapshot["insights"]["confidence"] == "low"
    assert len(snapshot["insights"]["trend"]) == 3
    assert build_twin_snapshot([])["insights"]["confidence"] == "insufficient"
