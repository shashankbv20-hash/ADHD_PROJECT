"""Multiple Object Tracking: server-held targets, load metrics and isolation from the Twin. Synthetic data."""

from app.schemas import ObjectTrackingEventInput
from app.services.object_tracking import (
    calculate_object_tracking_metrics,
    expected_targets,
    validate_object_tracking_event,
)
from tests.test_sessions_and_analytics import _create_subject

CODE = "multiple-object-tracking"


def _events(mode="scored", *, wrong=(), partial=(), empty=()):
    """Selects exactly the targets, except `wrong` (one target swapped for a non-target), `partial` (one
    target left out) and `empty` (nothing selected)."""
    events = []
    for index, targets in enumerate(expected_targets(mode)):
        selected = sorted(targets)
        if index in wrong:
            selected[-1] = next(i for i in range(8) if i not in targets)
        if index in partial:
            selected = selected[:-1]
        if index in empty:
            selected = []
        events.append(
            {
                "trialIndex": index,
                "trialId": f"{CODE}-{mode}-{index + 1:02d}",
                "objectCount": 8,
                "targetCount": len(targets),
                "selected": selected,
                "responseTimeMs": 3000 if selected else None,
            }
        )
    return events


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
        validate_object_tracking_event(ObjectTrackingEventInput.model_validate(e), "scored") for e in events
    ]
    return calculate_object_tracking_metrics(validated)


def test_target_sets_have_the_designed_shape():
    assert [len(t) for t in expected_targets("scored")] == [2, 2, 3, 3, 4, 4]
    assert [len(t) for t in expected_targets("practice")] == [2]
    for targets in expected_targets("scored"):
        assert all(0 <= i < 8 for i in targets)


def test_perfect_run_reaches_the_highest_load():
    metrics = _metrics(_events())
    assert metrics["perfect_count"] == 6 and metrics["perfect_percent"] == 100.0
    assert metrics["highest_perfect_load"] == 4
    assert metrics["targets_found_percent"] == 100.0 and metrics["wrong_pick_count"] == 0
    assert [(g["target_count"], g["trial_count"]) for g in metrics["by_load"]] == [(2, 2), (3, 2), (4, 2)]


def test_misses_and_wrong_picks_lower_the_load_and_percentages():
    # Both load-4 trials have one target swapped (wrong pick); one load-3 trial leaves a target out.
    metrics = _metrics(_events(wrong=(4, 5), partial=(2,)))
    assert metrics["perfect_count"] == 3
    assert metrics["highest_perfect_load"] == 3
    assert metrics["wrong_pick_count"] == 2
    load_4 = next(g for g in metrics["by_load"] if g["target_count"] == 4)
    assert load_4["targets_found_percent"] == 75.0  # 3 of 4 found in each load-4 trial
    assert metrics["targets_found_percent"] == round((2 + 2 + 2 + 3 + 3 + 3) / 18 * 100, 1)


def test_no_selection_is_not_perfect_and_has_no_time():
    metrics = _metrics(_events(empty=tuple(range(6))))
    assert metrics["perfect_count"] == 0 and metrics["highest_perfect_load"] is None
    assert metrics["mean_response_time_ms"] is None


def test_end_to_end_server_scored_and_kept_out_of_the_twin(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "tracking-run-01")
    base = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}"

    posted = client.post(f"{base}/events:batch", headers=participant_headers, json={"events": _events()})
    assert posted.status_code == 200, posted.text
    assert client.post(f"{base}/complete", headers=participant_headers).status_code == 200

    summaries = client.get(f"/api/v1/sessions/{session['id']}/summary", headers=participant_headers).json()
    assert len(summaries) == 1 and summaries[0]["activityCode"] == CODE
    assert summaries[0]["metrics"]["highestPerfectLoad"] == 4
    assert summaries[0]["calculationVersion"] == "backend-object-tracking-scoring-v1"

    twin = client.get(f"/api/v1/subjects/{subject['id']}/digital-twin", headers=participant_headers).json()
    assert twin["version"] == 0 and twin["status"] == "insufficient_data"


def test_a_browser_cannot_change_the_trial_or_over_select(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "tracking-run-02")
    url = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch"

    wrong_load = _events()[:1]
    wrong_load[0]["targetCount"] = 3  # the first trial has 2 targets
    assert client.post(url, headers=participant_headers, json={"events": wrong_load}).status_code == 422

    too_many = _events()[:1]
    too_many[0]["selected"] = [0, 2, 5]
    assert client.post(url, headers=participant_headers, json={"events": too_many}).status_code == 422

    duplicate = _events()[:1]
    duplicate[0]["selected"] = [0, 0]
    assert client.post(url, headers=participant_headers, json={"events": duplicate}).status_code == 422

    no_time = _events()[:1]
    no_time[0]["responseTimeMs"] = None
    assert client.post(url, headers=participant_headers, json={"events": no_time}).status_code == 422
