"""Feeling check-ins (pre/post mood and energy ratings). All data is synthetic."""

from tests.test_sessions_and_analytics import _create_session, _create_subject, _start_cpt

CAREGIVER = {"Authorization": "Bearer caregiver-token"}
OTHER = {"Authorization": "Bearer other-participant-token"}


def _active_session(client, headers):
    client.get("/api/v1/users/me", headers=headers)
    subject = _create_subject(client, headers)
    session = _create_session(client, headers, subject["id"], "scored", "checkin-run-01")
    _start_cpt(client, headers, session)
    return subject, session


def _checkin(client, headers, session_id, phase="pre", mood=4, energy=3):
    return client.post(
        f"/api/v1/sessions/{session_id}/feeling-checkins",
        headers=headers,
        json={"phase": phase, "moodRating": mood, "energyRating": energy},
    )


def test_checkin_is_recorded_and_returns_the_ratings(test_app, participant_headers):
    _, client = test_app
    _, session = _active_session(client, participant_headers)

    response = _checkin(client, participant_headers, session["id"])

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["sessionId"] == session["id"]
    assert (body["phase"], body["moodRating"], body["energyRating"]) == ("pre", 4, 3)
    assert body["recordedAt"]


def test_identical_retry_returns_the_same_checkin(test_app, participant_headers):
    _, client = test_app
    _, session = _active_session(client, participant_headers)

    first = _checkin(client, participant_headers, session["id"]).json()
    retry = _checkin(client, participant_headers, session["id"])

    assert retry.status_code == 201
    assert retry.json()["id"] == first["id"]


def test_conflicting_checkin_for_the_same_phase_is_rejected_and_pre_post_are_independent(
    test_app, participant_headers
):
    _, client = test_app
    _, session = _active_session(client, participant_headers)
    assert _checkin(client, participant_headers, session["id"], "pre", 4, 3).status_code == 201

    conflict = _checkin(client, participant_headers, session["id"], "pre", 1, 1)
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "feeling_checkin_exists"

    assert _checkin(client, participant_headers, session["id"], "post", 2, 2).status_code == 201


def test_ratings_outside_one_to_five_are_rejected(test_app, participant_headers):
    _, client = test_app
    _, session = _active_session(client, participant_headers)

    assert _checkin(client, participant_headers, session["id"], mood=0).status_code == 422
    assert _checkin(client, participant_headers, session["id"], energy=6).status_code == 422


def test_checkin_requires_active_consent(test_app, participant_headers):
    _, client = test_app
    subject, session = _active_session(client, participant_headers)
    consents = client.get(f"/api/v1/subjects/{subject['id']}/consents", headers=participant_headers).json()[
        "items"
    ]
    client.post(
        f"/api/v1/subjects/{subject['id']}/consents/{consents[0]['id']}/withdraw", headers=participant_headers
    )

    response = _checkin(client, participant_headers, session["id"])

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "consent_required"


def test_only_the_owning_participant_can_record_a_checkin(test_app, participant_headers):
    _, client = test_app
    _, session = _active_session(client, participant_headers)

    assert _checkin(client, OTHER, session["id"]).status_code == 404
    assert _checkin(client, CAREGIVER, session["id"]).status_code == 404
