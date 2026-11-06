from datetime import UTC, datetime

from app.repositories.firestore import path
from app.services.cpt_scoring import CPT_PRACTICE_STIMULI, CPT_SCORED_STIMULI


def _events(stimuli: tuple[str, ...], prefix: str) -> list[dict]:
    events = []
    for index, stimulus in enumerate(stimuli):
        target = stimulus == "X"
        events.append(
            {
                "trialIndex": index,
                "trialId": f"cpt-{prefix}-{index + 1:02d}",
                "stimulus": stimulus,
                "isTarget": target,
                "responded": target,
                "reactionTimeMs": 500 if target else None,
            }
        )
    return events


def _create_subject(client, headers):
    response = client.post("/api/v1/subjects", headers=headers, json={})
    assert response.status_code == 201
    subject = response.json()
    consent = client.post(
        f"/api/v1/subjects/{subject['id']}/consents",
        headers=headers,
        json={
            "scope": "research",
            "version": "synthetic-test-v1",
            "idempotencyKey": "research-consent-session",
        },
    )
    assert consent.status_code == 201
    return subject


def _create_session(client, headers, subject_id, mode, key):
    response = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={
            "subjectId": subject_id,
            "idempotencyKey": key,
            "activities": [{"activityCode": "cpt", "mode": mode}],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _start_cpt(client, headers, session):
    response = client.post(f"/api/v1/sessions/{session['id']}/start", headers=headers)
    assert response.status_code == 200
    assignment_id = session["activities"][0]["id"]
    response = client.post(
        f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/start",
        headers=headers,
    )
    assert response.status_code == 200
    return assignment_id


def test_cpt_session_is_idempotent_server_scored_and_updates_twin(test_app, participant_headers):
    app, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session = _create_session(client, participant_headers, subject["id"], "scored", "cpt-scored-run-01")
    repeated = _create_session(client, participant_headers, subject["id"], "scored", "cpt-scored-run-01")
    assert repeated["id"] == session["id"]
    assignment_id = _start_cpt(client, participant_headers, session)
    assignment = app.state.repository.get(
        path("subjects", subject["id"], "sessions", session["id"], "activities", assignment_id)
    )
    assert assignment["configuration_snapshot"]["configuration_version"] == "frontend-cpt-config-v1"
    assert len(assignment["configuration_snapshot"]["stimuli"]) == 24
    payload = {"events": _events(CPT_SCORED_STIMULI, "scored")}
    event_url = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch"

    ingested = client.post(event_url, headers=participant_headers, json=payload)
    assert ingested.status_code == 200
    assert ingested.json() == {"acceptedCount": 24, "duplicateCount": 0, "totalEventCount": 24}
    retried = client.post(event_url, headers=participant_headers, json=payload)
    assert retried.status_code == 200
    assert retried.json() == {"acceptedCount": 0, "duplicateCount": 24, "totalEventCount": 24}

    completed = client.post(
        f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/complete",
        headers=participant_headers,
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    summaries = client.get(f"/api/v1/sessions/{session['id']}/summary", headers=participant_headers)
    assert summaries.status_code == 200
    metrics = summaries.json()[0]["metrics"]
    assert metrics["trialCount"] == 24
    assert metrics["targetCount"] == 6
    assert metrics["hitCount"] == 6
    assert metrics["correctRejectionCount"] == 18
    assert metrics["accuracyPercent"] == 100
    assert metrics["meanHitReactionTimeMs"] == 500
    assert metrics["dataProvenance"] == "frontend-cpt-demo-event-derived-v1"

    progress = client.get(f"/api/v1/subjects/{subject['id']}/progress", headers=participant_headers)
    assert progress.status_code == 200
    assert progress.json()["summaryCount"] == 1
    twin = client.get(f"/api/v1/subjects/{subject['id']}/digital-twin", headers=participant_headers)
    assert twin.status_code == 200
    assert twin.json()["version"] == 1
    assert twin.json()["status"] == "insufficient_data"
    assert twin.json()["profile"]["metrics"]["summary_count"] == 1

    report_payload = {"sessionId": session["id"], "idempotencyKey": "report-cpt-run-0001"}
    report_url = f"/api/v1/subjects/{subject['id']}/reports"
    report = client.post(report_url, headers=participant_headers, json=report_payload)
    report_retry = client.post(report_url, headers=participant_headers, json=report_payload)
    assert report.status_code == report_retry.status_code == 201
    assert report.json()["id"] == report_retry.json()["id"]
    assert report.json()["content"]["limitations"]
    assert client.get(report_url, headers=participant_headers).json()["items"][0]["id"] == report.json()["id"]
    other_headers = {"Authorization": "Bearer other-participant-token"}
    assert client.get(f"/api/v1/sessions/{session['id']}", headers=other_headers).status_code == 404
    assert client.get(report_url, headers=other_headers).status_code == 404

    # A second scored session creates a new immutable history version and a
    # descriptive baseline difference from persisted source summaries.
    second_session = _create_session(
        client, participant_headers, subject["id"], "scored", "cpt-scored-run-02"
    )
    second_assignment = _start_cpt(client, participant_headers, second_session)
    no_response_events = _events(CPT_SCORED_STIMULI, "scored")
    for event in no_response_events:
        event["responded"] = False
        event["reactionTimeMs"] = None
    second_event_url = f"/api/v1/sessions/{second_session['id']}/activities/{second_assignment}/events:batch"
    assert (
        client.post(
            second_event_url,
            headers=participant_headers,
            json={"events": no_response_events},
        ).status_code
        == 200
    )
    second_complete = client.post(
        f"/api/v1/sessions/{second_session['id']}/activities/{second_assignment}/complete",
        headers=participant_headers,
    )
    assert second_complete.status_code == 200
    twin_after_second = client.get(
        f"/api/v1/subjects/{subject['id']}/digital-twin", headers=participant_headers
    ).json()
    assert twin_after_second["version"] == 2
    assert twin_after_second["status"] == "available"
    assert twin_after_second["profile"]["change"]["accuracy_delta_percentage_points"] == -25
    summary_page = client.get(
        f"/api/v1/subjects/{subject['id']}/activity-summaries",
        headers=participant_headers,
        params={"limit": 1},
    )
    assert summary_page.status_code == 200
    assert len(summary_page.json()["items"]) == 1
    assert summary_page.json()["nextCursor"]
    summary_page_2 = client.get(
        f"/api/v1/subjects/{subject['id']}/activity-summaries",
        headers=participant_headers,
        params={"limit": 1, "cursor": summary_page.json()["nextCursor"]},
    )
    assert summary_page_2.status_code == 200
    assert len(summary_page_2.json()["items"]) == 1
    assert summary_page_2.json()["nextCursor"] is None
    history = client.get(
        f"/api/v1/subjects/{subject['id']}/digital-twin/history",
        headers=participant_headers,
    )
    assert [item["version"] for item in history.json()["items"]] == [2, 1]

    # A practice run is persisted as events for its session but never becomes a
    # scored ActivitySummary or a Digital Twin source observation.
    practice = _create_session(client, participant_headers, subject["id"], "practice", "cpt-practice-run-01")
    practice_assignment = _start_cpt(client, participant_headers, practice)
    practice_url = f"/api/v1/sessions/{practice['id']}/activities/{practice_assignment}/events:batch"
    practice_events = client.post(
        practice_url,
        headers=participant_headers,
        json={"events": _events(CPT_PRACTICE_STIMULI, "practice")},
    )
    assert practice_events.status_code == 200
    practice_done = client.post(
        f"/api/v1/sessions/{practice['id']}/activities/{practice_assignment}/complete",
        headers=participant_headers,
    )
    assert practice_done.status_code == 200
    repository = app.state.repository
    assert len(repository.list(path("subjects", subject["id"], "activitySummaries"))) == 2
    assert repository.get(path("subjects", subject["id"], "digitalTwin", "current"))["current_version"] == 2
    assert len(repository.list(path("subjects", subject["id"], "reports"))) == 1


def test_invalid_cpt_sequence_is_rejected_before_event_write(test_app, participant_headers):
    app, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session = _create_session(client, participant_headers, subject["id"], "scored", "cpt-bad-event-0001")
    assignment_id = _start_cpt(client, participant_headers, session)
    invalid = {
        "events": [
            {
                "trialIndex": 0,
                "trialId": "cpt-scored-01",
                "stimulus": "X",
                "isTarget": True,
                "responded": True,
                "reactionTimeMs": 400,
            }
        ]
    }
    response = client.post(
        f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch",
        headers=participant_headers,
        json=invalid,
    )
    assert response.status_code == 422
    assignment = app.state.repository.list(
        path("subjects", subject["id"], "sessions", session["id"], "activities")
    )[0]
    assert (
        app.state.repository.list(
            path(
                "subjects", subject["id"], "sessions", session["id"], "activities", assignment["id"], "events"
            )
        )
        == []
    )


def test_planned_activity_cannot_be_started_as_if_implemented(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    response = client.post(
        "/api/v1/sessions",
        headers=participant_headers,
        json={
            "subjectId": subject["id"],
            "idempotencyKey": "planned-activity-0001",
            "activities": [{"activityCode": "n-back", "mode": "scored"}],
        },
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "activity_unavailable"


def test_session_creation_requires_active_research_consent(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject_response = client.post("/api/v1/subjects", headers=participant_headers, json={})
    subject_id = subject_response.json()["id"]
    payload = {
        "subjectId": subject_id,
        "idempotencyKey": "no-consent-cpt-0001",
        "activities": [{"activityCode": "cpt", "mode": "scored"}],
    }
    blocked = client.post("/api/v1/sessions", headers=participant_headers, json=payload)
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "consent_required"

    consent = client.post(
        f"/api/v1/subjects/{subject_id}/consents",
        headers=participant_headers,
        json={
            "scope": "research",
            "version": "synthetic-test-v1",
            "idempotencyKey": "research-consent-withdraw",
        },
    )
    assert consent.status_code == 201
    created = client.post("/api/v1/sessions", headers=participant_headers, json=payload)
    assert created.status_code == 201
    started = client.post(f"/api/v1/sessions/{created.json()['id']}/start", headers=participant_headers)
    assert started.status_code == 200

    withdrawn = client.post(
        f"/api/v1/subjects/{subject_id}/consents/{consent.json()['id']}/withdraw",
        headers=participant_headers,
    )
    assert withdrawn.status_code == 200
    assignment_id = created.json()["activities"][0]["id"]
    skip = client.post(
        f"/api/v1/sessions/{created.json()['id']}/activities/{assignment_id}/skip",
        headers=participant_headers,
    )
    assert skip.status_code == 403
    paused = client.post(f"/api/v1/sessions/{created.json()['id']}/pause", headers=participant_headers)
    assert paused.status_code == 200
    resume = client.post(f"/api/v1/sessions/{created.json()['id']}/resume", headers=participant_headers)
    assert resume.status_code == 403
    assert resume.json()["error"]["code"] == "consent_required"
    cancelled = client.post(f"/api/v1/sessions/{created.json()['id']}/cancel", headers=participant_headers)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"


def test_session_cursor_handles_tied_timestamps(test_app, participant_headers):
    app, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    first = _create_session(client, participant_headers, subject["id"], "practice", "cursor-session-0001")
    second = _create_session(client, participant_headers, subject["id"], "practice", "cursor-session-0002")

    tied_time = datetime(2026, 11, 3, 12, 0, tzinfo=UTC)
    first_path = path("subjects", subject["id"], "sessions", first["id"])
    second_path = path("subjects", subject["id"], "sessions", second["id"])
    app.state.repository.update(first_path, {"created_at": tied_time})
    app.state.repository.update(second_path, {"created_at": tied_time})

    params = {"subjectId": subject["id"], "limit": 1}
    first_page = client.get("/api/v1/sessions", headers=participant_headers, params=params)
    assert first_page.status_code == 200
    first_body = first_page.json()
    assert first_body["nextCursor"]
    second_page = client.get(
        "/api/v1/sessions",
        headers=participant_headers,
        params={**params, "cursor": first_body["nextCursor"]},
    )
    assert second_page.status_code == 200
    assert len(second_page.json()["items"]) == 1
    assert second_page.json()["items"][0]["id"] != first_body["items"][0]["id"]
    assert second_page.json()["nextCursor"] is None
