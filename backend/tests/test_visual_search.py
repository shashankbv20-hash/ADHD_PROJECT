"""Visual Search: server-derived answers, per-size timings, search slope and isolation from the Twin. Synthetic data."""

from app.schemas import VisualSearchEventInput
from app.services.visual_search import (
    calculate_visual_search_metrics,
    expected_trials,
    validate_visual_search_event,
)
from tests.test_sessions_and_analytics import _create_subject

CODE = "visual-search"


def _rt(size, present):
    """Present trials: 400 ms + 50 ms per item. Absent trials are slower (no effect on the slope)."""
    return 400 + 50 * size + (300 if not present else 0)


def _events(mode="scored", *, wrong=(), skip=()):
    events = []
    for index, (size, present) in enumerate(expected_trials(mode)):
        if index in skip:
            answer, rt = None, None
        else:
            says_present = (not present) if index in wrong else present
            answer, rt = ("present" if says_present else "absent"), _rt(size, present)
        events.append(
            {
                "trialIndex": index,
                "trialId": f"{CODE}-{mode}-{index + 1:02d}",
                "setSize": size,
                "targetPresent": present,
                "responded": answer is not None,
                "response": answer,
                "reactionTimeMs": rt,
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
        validate_visual_search_event(VisualSearchEventInput.model_validate(e), "scored") for e in events
    ]
    return calculate_visual_search_metrics(validated)


def test_trial_lists_have_the_designed_shape():
    assert len(expected_trials("practice")) == 6
    scored = expected_trials("scored")
    assert len(scored) == 30
    for size in (4, 8, 12):
        group = [present for n, present in scored if n == size]
        assert len(group) == 10 and sum(group) == 5  # five present, five absent per size


def test_metrics_slope_and_condition_accuracy():
    present_idx = [i for i, (_, p) in enumerate(expected_trials("scored")) if p]
    metrics = _metrics(_events(wrong=(present_idx[0],), skip=(present_idx[1],)))

    assert metrics["target_present_count"] == 15 and metrics["target_absent_count"] == 15
    assert metrics["error_count"] == 1 and metrics["omission_count"] == 1
    assert metrics["absent_accuracy_percent"] == 100.0
    assert metrics["present_accuracy_percent"] == round(13 / 15 * 100, 1)
    assert metrics["accuracy_percent"] == round(28 / 30 * 100, 1)
    assert metrics["search_slope_ms_per_item"] == 50.0
    assert [s["set_size"] for s in metrics["reaction_time_by_set_size"]] == [4, 8, 12]


def test_slope_is_withheld_without_two_set_sizes():
    scored = expected_trials("scored")
    keep_only_size_4 = tuple(i for i, (n, _) in enumerate(scored) if n != 4)
    assert _metrics(_events(skip=keep_only_size_4))["search_slope_ms_per_item"] is None


def test_end_to_end_server_scored_and_kept_out_of_the_twin(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(
        client, participant_headers, subject["id"], "scored", "visual-search-run-01"
    )
    base = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}"

    assert (
        client.post(
            f"{base}/events:batch", headers=participant_headers, json={"events": _events()}
        ).status_code
        == 200
    )
    assert client.post(f"{base}/complete", headers=participant_headers).status_code == 200

    summaries = client.get(f"/api/v1/sessions/{session['id']}/summary", headers=participant_headers).json()
    assert len(summaries) == 1 and summaries[0]["activityCode"] == CODE
    assert summaries[0]["metrics"]["searchSlopeMsPerItem"] == 50.0
    assert summaries[0]["calculationVersion"] == "backend-visual-search-scoring-v1"

    twin = client.get(f"/api/v1/subjects/{subject['id']}/digital-twin", headers=participant_headers).json()
    assert twin["version"] == 0 and twin["status"] == "insufficient_data"


def test_a_browser_cannot_relabel_trials(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(
        client, participant_headers, subject["id"], "scored", "visual-search-run-02"
    )
    url = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch"

    flipped = _events()[:1]
    flipped[0]["targetPresent"] = not flipped[0]["targetPresent"]  # claim a different truth
    assert client.post(url, headers=participant_headers, json={"events": flipped}).status_code == 422

    no_answer = _events()[:1]
    no_answer[0]["response"] = None  # responded but no answer
    assert client.post(url, headers=participant_headers, json={"events": no_answer}).status_code == 422
