"""Go/No-Go: server-validated scoring, and that it stays out of the CPT-based Twin. Synthetic data."""

from app.schemas import CptEventInput
from app.services.cpt_scoring import (
    GO_NO_GO_PRACTICE_STIMULI,
    GO_NO_GO_SCORED_STIMULI,
    calculate_activity_metrics,
    expected_stimuli,
    validate_cpt_event,
)
from tests.test_sessions_and_analytics import _create_subject

CODE = "go-no-go"


def _events(stimuli, mode, *, press_on_no_go=(), skip_go=(), rt=450):
    events = []
    for index, stimulus in enumerate(stimuli):
        go = stimulus == "G"
        responded = (go and index not in skip_go) or (not go and index in press_on_no_go)
        events.append(
            {
                "trialIndex": index,
                "trialId": f"{CODE}-{mode}-{index + 1:02d}",
                "stimulus": stimulus,
                "isTarget": go,
                "responded": responded,
                "reactionTimeMs": rt if responded else None,
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


def test_sequences_have_the_designed_shape():
    assert len(GO_NO_GO_PRACTICE_STIMULI) == 8 and GO_NO_GO_PRACTICE_STIMULI.count("N") == 2
    assert len(GO_NO_GO_SCORED_STIMULI) == 32 and GO_NO_GO_SCORED_STIMULI.count("N") == 8
    # Two no-go trials in every block of eight (the scoring reports blocks of eight).
    for start in range(0, 32, 8):
        assert GO_NO_GO_SCORED_STIMULI[start : start + 8].count("N") == 2
    assert "NN" not in "".join(GO_NO_GO_SCORED_STIMULI)
    assert expected_stimuli("scored", CODE) == GO_NO_GO_SCORED_STIMULI
    assert expected_stimuli("scored") != GO_NO_GO_SCORED_STIMULI  # CPT is unchanged


def test_scoring_counts_omissions_and_commissions():
    events = [
        validate_cpt_event(CptEventInput.model_validate(e), "scored", CODE)
        for e in _events(GO_NO_GO_SCORED_STIMULI, "scored", press_on_no_go=(2, 6), skip_go=(0,))
    ]
    metrics = calculate_activity_metrics(events, CODE)

    assert metrics["trial_count"] == 32
    assert metrics["target_count"] == 24 and metrics["non_target_count"] == 8
    assert metrics["omission_error_count"] == 1  # one missed go
    assert metrics["commission_error_count"] == 2  # two presses on no-go
    assert metrics["hit_count"] == 23 and metrics["correct_rejection_count"] == 6
    assert metrics["accuracy_percent"] == round(29 / 32 * 100)
    assert metrics["calculation_version"] == "backend-go-no-go-scoring-v1"
    assert len(metrics["block_metrics"]) == 4


def test_end_to_end_session_is_scored_by_the_server_and_kept_out_of_the_twin(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "gng-run-01")

    ingested = client.post(
        f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch",
        headers=participant_headers,
        json={"events": _events(GO_NO_GO_SCORED_STIMULI, "scored", press_on_no_go=(2,))},
    )
    assert ingested.status_code == 200, ingested.text
    done = client.post(
        f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/complete", headers=participant_headers
    )
    assert done.status_code == 200, done.text

    summaries = client.get(f"/api/v1/sessions/{session['id']}/summary", headers=participant_headers).json()
    assert len(summaries) == 1 and summaries[0]["activityCode"] == CODE
    assert summaries[0]["metrics"]["commissionErrorCount"] == 1
    assert summaries[0]["calculationVersion"] == "backend-go-no-go-scoring-v1"

    # The CPT-based profile, progress and reports must not include it.
    sid = subject["id"]
    twin = client.get(f"/api/v1/subjects/{sid}/digital-twin", headers=participant_headers).json()
    assert twin["status"] == "insufficient_data" and twin["version"] == 0
    progress = client.get(f"/api/v1/subjects/{sid}/progress", headers=participant_headers).json()
    assert progress["summaryCount"] == 0
    report = client.post(
        f"/api/v1/subjects/{sid}/reports",
        headers=participant_headers,
        json={"idempotencyKey": "gng-report-01"},
    )
    assert report.status_code == 409 and report.json()["error"]["code"] == "report_insufficient_data"


def test_events_must_match_the_go_no_go_sequence(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "gng-run-02")
    url = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch"

    wrong_stimulus = _events(GO_NO_GO_SCORED_STIMULI, "scored")[:1]
    wrong_stimulus[0]["stimulus"] = "N"
    assert client.post(url, headers=participant_headers, json={"events": wrong_stimulus}).status_code == 422

    cpt_style_id = _events(GO_NO_GO_SCORED_STIMULI, "scored")[:1]
    cpt_style_id[0]["trialId"] = "cpt-scored-01"
    assert client.post(url, headers=participant_headers, json={"events": cpt_style_id}).status_code == 422

    incomplete = client.post(
        url, headers=participant_headers, json={"events": _events(GO_NO_GO_SCORED_STIMULI, "scored")[:10]}
    )
    assert incomplete.status_code == 200
    refused = client.post(
        f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/complete", headers=participant_headers
    )
    assert refused.status_code == 409 and refused.json()["error"]["code"] == "activity_events_incomplete"


def test_practice_run_is_not_scored(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(
        client, participant_headers, subject["id"], "practice", "gng-practice-01"
    )
    assert (
        client.post(
            f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch",
            headers=participant_headers,
            json={"events": _events(GO_NO_GO_PRACTICE_STIMULI, "practice")},
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/complete",
            headers=participant_headers,
        ).status_code
        == 200
    )
    assert client.get(f"/api/v1/sessions/{session['id']}/summary", headers=participant_headers).json() == []


def test_response_window_allows_answers_up_to_2_2_seconds(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "gng-window-01")
    url = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch"

    slow = _events(GO_NO_GO_SCORED_STIMULI, "scored", rt=2200)[:1]
    assert client.post(url, headers=participant_headers, json={"events": slow}).status_code == 200
    too_slow = _events(GO_NO_GO_SCORED_STIMULI, "scored", rt=2201)[1:2]
    assert client.post(url, headers=participant_headers, json={"events": too_slow}).status_code == 422
