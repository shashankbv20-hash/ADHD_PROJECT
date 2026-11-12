"""Time Perception: server-held durations, error metrics and isolation from the Twin. Synthetic data."""

from app.schemas import TimePerceptionEventInput
from app.services.time_perception import (
    SCORED_TARGETS_MS,
    calculate_time_perception_metrics,
    expected_targets,
    validate_time_perception_event,
)
from tests.test_sessions_and_analytics import _create_subject

CODE = "time-perception"


def _events(mode="scored", *, factor=1.0, skip=()):
    """Reproduces each duration as `factor` times the target (1.0 = exact); `skip` gives no answer."""
    return [
        {
            "trialIndex": index,
            "trialId": f"{CODE}-{mode}-{index + 1:02d}",
            "targetMs": target,
            "reproducedMs": None if index in skip else round(target * factor),
        }
        for index, target in enumerate(expected_targets(mode))
    ]


def _session(client, headers, subject_id, mode, key):
    response = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={
            "subjectId": subject_id,
            "idempotencyKey": key,
            "activities": [{"activityCode": CODE, "mode": mode}],
        },
    )
    assert response.status_code == 201, response.text
    session = response.json()
    assert client.post(f"/api/v1/sessions/{session['id']}/start", headers=headers).status_code == 200
    assignment_id = session["activities"][0]["id"]
    started = client.post(
        f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/start", headers=headers
    )
    assert started.status_code == 200, started.text
    return session, assignment_id


def _metrics(events):
    validated = [
        validate_time_perception_event(TimePerceptionEventInput.model_validate(e), "scored") for e in events
    ]
    return calculate_time_perception_metrics(validated)


def test_targets_have_the_designed_shape():
    assert len(SCORED_TARGETS_MS) == 8
    assert min(SCORED_TARGETS_MS) == 1000 and max(SCORED_TARGETS_MS) == 4500
    assert len(set(SCORED_TARGETS_MS)) == 8


def test_exact_reproduction_has_no_error():
    metrics = _metrics(_events())
    assert metrics["mean_absolute_error_ms"] == 0 and metrics["mean_signed_error_ms"] == 0
    assert metrics["mean_ratio"] == 1.0 and metrics["ratio_variability"] == 0.0
    assert metrics["within_tolerance_percent"] == 100.0


def test_overestimating_gives_positive_bias_and_ratio():
    metrics = _metrics(_events(factor=1.5))
    assert metrics["mean_ratio"] == 1.5
    assert metrics["mean_signed_error_ms"] > 0
    assert metrics["mean_absolute_error_ms"] == metrics["mean_signed_error_ms"]
    assert metrics["within_tolerance_count"] == 0


def test_underestimating_gives_negative_bias_and_unanswered_trials_are_counted():
    metrics = _metrics(_events(factor=0.5, skip=(0, 1)))
    assert metrics["mean_signed_error_ms"] < 0
    assert metrics["response_count"] == 6 and metrics["no_response_count"] == 2
    assert metrics["within_tolerance_percent"] == 0.0


def test_no_responses_withhold_the_error_metrics():
    metrics = _metrics(_events(skip=tuple(range(8))))
    assert metrics["mean_absolute_error_ms"] is None and metrics["mean_ratio"] is None
    assert metrics["ratio_variability"] is None


def test_end_to_end_server_scored_and_kept_out_of_the_twin(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "time-run-01")
    base = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}"

    posted = client.post(
        f"{base}/events:batch", headers=participant_headers, json={"events": _events(factor=1.1)}
    )
    assert posted.status_code == 200, posted.text
    assert client.post(f"{base}/complete", headers=participant_headers).status_code == 200

    summaries = client.get(f"/api/v1/sessions/{session['id']}/summary", headers=participant_headers).json()
    assert len(summaries) == 1 and summaries[0]["activityCode"] == CODE
    assert summaries[0]["metrics"]["meanRatio"] == 1.1
    assert summaries[0]["calculationVersion"] == "backend-time-perception-scoring-v1"

    twin = client.get(f"/api/v1/subjects/{subject['id']}/digital-twin", headers=participant_headers).json()
    assert twin["version"] == 0 and twin["status"] == "insufficient_data"


def test_a_browser_cannot_change_the_target_duration(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "time-run-02")
    url = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch"

    changed = _events()[:1]
    changed[0]["targetMs"] = 2000  # the real first target is 3000
    assert client.post(url, headers=participant_headers, json={"events": changed}).status_code == 422
