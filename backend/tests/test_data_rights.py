"""Participant data rights: export, access log and erasure.

Runs against the in-memory repository and, when available, the Firestore emulator
(see conftest.py). All data is synthetic.
"""

import json

from app.repositories.firestore import path
from app.services.cpt_scoring import CPT_SCORED_STIMULI
from tests.test_sessions_and_analytics import _create_session, _create_subject, _events, _start_cpt

OTHER = {"Authorization": "Bearer other-participant-token"}
CAREGIVER = {"Authorization": "Bearer caregiver-token"}
CLINICIAN = {"Authorization": "Bearer clinician-token"}
CONFIRM = {"confirmation": "ERASE MY DATA"}


def _complete_run(client, headers, subject_id, key, *, check_in=False):
    session = _create_session(client, headers, subject_id, "scored", key)
    assignment_id = _start_cpt(client, headers, session)
    if check_in:
        response = client.post(
            f"/api/v1/sessions/{session['id']}/feeling-checkins",
            headers=headers,
            json={"phase": "pre", "moodRating": 4, "energyRating": 3},
        )
        assert response.status_code == 201, response.text
    ingested = client.post(
        f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch",
        headers=headers,
        json={"events": _events(CPT_SCORED_STIMULI, "scored")},
    )
    assert ingested.status_code == 200, ingested.text
    completed = client.post(
        f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/complete", headers=headers
    )
    assert completed.status_code == 200, completed.text
    return session


def _populated_subject(client, headers):
    client.get("/api/v1/users/me", headers=headers)
    subject = _create_subject(client, headers)
    _complete_run(client, headers, subject["id"], "rights-run-01", check_in=True)
    _complete_run(client, headers, subject["id"], "rights-run-02")
    report = client.post(
        f"/api/v1/subjects/{subject['id']}/reports",
        headers=headers,
        json={"idempotencyKey": "rights-report-01"},
    )
    assert report.status_code == 201, report.text
    return subject


def test_export_contains_everything_stored_for_the_owner(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)

    response = client.get(f"/api/v1/subjects/{subject['id']}/export", headers=participant_headers)

    assert response.status_code == 200
    bundle = response.json()
    json.dumps(bundle)  # fully JSON-serializable
    assert bundle["subject"]["id"] == subject["id"]
    assert len(bundle["consents"]) == 1
    assert len(bundle["sessions"]) == 2
    for session in bundle["sessions"]:
        assert len(session["activities"]) == 1
        assert len(session["activities"][0]["events"]) == 24
        assert [e["trial_index"] for e in session["activities"][0]["events"]] == list(range(24))
    assert sum(len(session["feelingCheckIns"]) for session in bundle["sessions"]) == 1
    assert len(bundle["activitySummaries"]) == 2
    assert bundle["digitalTwin"]["current"]["current_version"] == 2
    assert [item["version"] for item in bundle["digitalTwin"]["history"]] == [1, 2]
    assert len(bundle["reports"]) == 1
    assert bundle["notes"]
    assert any(entry["action"] == "consent_granted" for entry in bundle["accessLog"])
    # Internal bookkeeping is not part of the participant's data.
    assert "request_fingerprint" not in json.dumps(bundle)


def test_export_is_audited_and_limited_to_the_owner(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    sid = subject["id"]

    for headers in (OTHER, CAREGIVER, CLINICIAN):
        assert client.get(f"/api/v1/subjects/{sid}/export", headers=headers).status_code == 404
    assert client.get(f"/api/v1/subjects/{sid}/export").status_code == 401

    client.get(f"/api/v1/subjects/{sid}/export", headers=participant_headers)
    log = client.get(f"/api/v1/subjects/{sid}/audit-events?limit=500", headers=participant_headers).json()[
        "items"
    ]
    exports = [entry for entry in log if entry["action"] == "subject_data_exported"]
    assert len(exports) == 1
    assert exports[0]["details"] == {"session_count": 2, "summary_count": 2, "report_count": 1}


def test_access_log_shows_other_accounts_without_exposing_their_identity(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    sid = subject["id"]
    client.get(f"/api/v1/subjects/{sid}", headers=OTHER)  # a denied attempt by another account

    response = client.get(f"/api/v1/subjects/{sid}/audit-events", headers=participant_headers)

    assert response.status_code == 200
    items = response.json()["items"]
    own = [entry for entry in items if entry["actorIsYou"]]
    foreign = [entry for entry in items if not entry["actorIsYou"]]
    assert any(entry["action"] == "consent_granted" for entry in own)
    assert [entry["action"] for entry in foreign] == ["subject_access_denied"]
    serialized = json.dumps(items)
    assert "other-participant-test-uid" not in serialized
    assert "participant-test-uid" not in serialized
    # Newest first.
    times = [entry["createdAt"] for entry in items]
    assert times == sorted(times, reverse=True)
    # Only simple values are returned as details.
    for entry in items:
        assert all(isinstance(v, str | int | float | bool | type(None)) for v in entry["details"].values())


def test_access_log_is_owner_only(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)

    for headers in (OTHER, CAREGIVER, CLINICIAN):
        assert (
            client.get(f"/api/v1/subjects/{subject['id']}/audit-events", headers=headers).status_code == 404
        )


def test_erasure_requires_the_exact_confirmation_phrase(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    url = f"/api/v1/subjects/{subject['id']}/data-erasure"

    for body in ({}, {"confirmation": "yes"}, {"confirmation": "erase my data"}):
        assert client.post(url, headers=participant_headers, json=body).status_code == 422

    # Nothing was touched.
    progress = client.get(f"/api/v1/subjects/{subject['id']}/progress", headers=participant_headers).json()
    assert progress["summaryCount"] == 2


def test_erasure_is_owner_only(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    url = f"/api/v1/subjects/{subject['id']}/data-erasure"

    for headers in (OTHER, CAREGIVER, CLINICIAN):
        assert client.post(url, headers=headers, json=CONFIRM).status_code == 404
    assert client.post(url, json=CONFIRM).status_code == 401
    assert (
        client.get(f"/api/v1/subjects/{subject['id']}/progress", headers=participant_headers).json()[
            "summaryCount"
        ]
        == 2
    )


def test_erasure_deletes_research_data_but_keeps_subject_consent_history_and_audit(
    test_app, participant_headers
):
    app, client = test_app
    repository = app.state.repository
    subject = _populated_subject(client, participant_headers)
    sid = subject["id"]

    response = client.post(f"/api/v1/subjects/{sid}/data-erasure", headers=participant_headers, json=CONFIRM)

    assert response.status_code == 200
    result = response.json()
    assert result["subjectId"] == sid
    assert result["withdrawnConsentCount"] == 1
    counts = result["deletedDocumentCounts"]
    assert counts["activitySummaries"] == 2
    assert counts["digitalTwin"] == 1
    assert counts["digitalTwinHistory"] == 2
    assert counts["reports"] == 1
    assert counts["reportIdempotency"] == 1
    assert counts["sessionIdempotency"] == 2
    # 2 sessions + 2 activities + 48 trial events + 1 check-in
    assert counts["sessions"] == 2 + 2 + 48 + 1

    # Research data is gone.
    assert (
        client.get(f"/api/v1/subjects/{sid}/progress", headers=participant_headers).json()["summaryCount"]
        == 0
    )
    twin = client.get(f"/api/v1/subjects/{sid}/digital-twin", headers=participant_headers).json()
    assert twin["version"] == 0 and twin["status"] == "insufficient_data"
    assert (
        client.get(f"/api/v1/subjects/{sid}/digital-twin/history", headers=participant_headers).json()[
            "items"
        ]
        == []
    )
    assert client.get(f"/api/v1/subjects/{sid}/reports", headers=participant_headers).json()["items"] == []
    assert client.get(f"/api/v1/sessions?subjectId={sid}", headers=participant_headers).json()["items"] == []
    assert repository.list("sessionIdempotency", filters=(("subject_id", "==", sid),)) == []

    # Subject, consent history and audit trail remain.
    stored = repository.get(path("subjects", sid))
    assert stored is not None and stored["data_erased_at"] is not None
    consents = client.get(f"/api/v1/subjects/{sid}/consents", headers=participant_headers).json()["items"]
    assert [consent["status"] for consent in consents] == ["withdrawn"]
    log = client.get(f"/api/v1/subjects/{sid}/audit-events?limit=500", headers=participant_headers).json()[
        "items"
    ]
    actions = [entry["action"] for entry in log]
    assert "subject_data_erased" in actions and "consent_withdrawn" in actions

    # The export now shows an empty dataset, with the history of what happened.
    bundle = client.get(f"/api/v1/subjects/{sid}/export", headers=participant_headers).json()
    assert bundle["sessions"] == [] and bundle["activitySummaries"] == [] and bundle["reports"] == []
    assert bundle["subject"]["data_erased_at"] is not None


def test_erasure_stops_collection_until_consent_is_granted_again(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    sid = subject["id"]
    client.post(f"/api/v1/subjects/{sid}/data-erasure", headers=participant_headers, json=CONFIRM)

    blocked = client.post(
        "/api/v1/sessions",
        headers=participant_headers,
        json={
            "subjectId": sid,
            "idempotencyKey": "after-erasure-01",
            "activities": [{"activityCode": "cpt", "mode": "scored"}],
        },
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "consent_required"

    regrant = client.post(
        f"/api/v1/subjects/{sid}/consents",
        headers=participant_headers,
        json={"scope": "research", "version": "synthetic-test-v1", "idempotencyKey": "regrant-consent-01"},
    )
    assert regrant.status_code == 201
    # A retry key used before erasure must not resurrect or break anything.
    session = _complete_run(client, participant_headers, sid, "rights-run-01")
    assert session["id"]
    progress = client.get(f"/api/v1/subjects/{sid}/progress", headers=participant_headers).json()
    assert progress["summaryCount"] == 1


def test_erasure_is_idempotent_and_leaves_other_subjects_alone(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    client.get("/api/v1/users/me", headers=OTHER)
    other_subject = _create_subject(client, OTHER)
    _complete_run(client, OTHER, other_subject["id"], "other-run-01")

    first = client.post(
        f"/api/v1/subjects/{subject['id']}/data-erasure", headers=participant_headers, json=CONFIRM
    )
    second = client.post(
        f"/api/v1/subjects/{subject['id']}/data-erasure", headers=participant_headers, json=CONFIRM
    )

    assert first.status_code == 200 and second.status_code == 200
    assert second.json()["withdrawnConsentCount"] == 0
    assert all(count == 0 for count in second.json()["deletedDocumentCounts"].values())
    other_progress = client.get(f"/api/v1/subjects/{other_subject['id']}/progress", headers=OTHER).json()
    assert other_progress["summaryCount"] == 1
