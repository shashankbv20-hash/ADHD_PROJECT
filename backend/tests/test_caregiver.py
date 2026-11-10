"""Caregiver sharing: what a caregiver can and cannot do. All data is synthetic."""

import json

from tests.test_data_rights import _populated_subject

CAREGIVER = {"Authorization": "Bearer caregiver-token"}
CAREGIVER_UID = "caregiver-test-uid"
OTHER = {"Authorization": "Bearer other-participant-token"}
CLINICIAN = {"Authorization": "Bearer clinician-token"}


def _share(client, owner_headers, subject_id, caregiver_uid=CAREGIVER_UID):
    # A caregiver account is provisioned the first time it calls the API.
    client.get("/api/v1/users/me", headers=CAREGIVER)
    return client.post(
        f"/api/v1/subjects/{subject_id}/caregivers",
        headers=owner_headers,
        json={"caregiverFirebaseUid": caregiver_uid},
    )


def _shared_subjects(client, headers=CAREGIVER):
    response = client.get("/api/v1/caregiver/subjects", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["items"]


def test_shared_subjects_lists_only_active_shares_without_owner_identity(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    client.get("/api/v1/users/me", headers=CAREGIVER)
    assert _shared_subjects(client) == []

    grant = _share(client, participant_headers, subject["id"])
    assert grant.status_code == 201, grant.text

    items = _shared_subjects(client)
    assert len(items) == 1
    assert items[0]["subjectId"] == subject["id"]
    assert items[0]["relationshipId"] == grant.json()["id"]
    assert items[0]["sharedSince"]
    # The caregiver is not told who the owner is.
    assert "participant-test-uid" not in json.dumps(items)
    assert "ownerUserId" not in items[0]


def test_shared_subjects_is_for_caregivers_only(test_app, participant_headers):
    _, client = test_app

    for headers in (participant_headers, OTHER, CLINICIAN):
        assert client.get("/api/v1/caregiver/subjects", headers=headers).status_code == 403
    assert client.get("/api/v1/caregiver/subjects").status_code == 401


def test_caregiver_can_read_progress_but_not_the_trial_level_export(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    sid = subject["id"]
    _share(client, participant_headers, sid)

    assert client.get(f"/api/v1/subjects/{sid}/progress", headers=CAREGIVER).json()["summaryCount"] == 2
    twin = client.get(f"/api/v1/subjects/{sid}/digital-twin", headers=CAREGIVER).json()
    assert twin["version"] == 2 and twin["status"] == "available"
    assert (
        len(client.get(f"/api/v1/subjects/{sid}/digital-twin/history", headers=CAREGIVER).json()["items"])
        == 2
    )
    assert (
        len(client.get(f"/api/v1/subjects/{sid}/activity-summaries", headers=CAREGIVER).json()["items"]) == 2
    )
    assert len(client.get(f"/api/v1/subjects/{sid}/reports", headers=CAREGIVER).json()["items"]) == 1
    assert len(client.get(f"/api/v1/sessions?subjectId={sid}", headers=CAREGIVER).json()["items"]) == 2

    # Owner-only surfaces stay closed.
    assert client.get(f"/api/v1/subjects/{sid}/export", headers=CAREGIVER).status_code == 404
    assert client.get(f"/api/v1/subjects/{sid}/audit-events", headers=CAREGIVER).status_code == 404
    assert client.get(f"/api/v1/subjects/{sid}/caregivers", headers=CAREGIVER).status_code == 404


def test_caregiver_cannot_change_anything(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    sid = subject["id"]
    _share(client, participant_headers, sid)

    writes = [
        ("post", f"/api/v1/subjects/{sid}/data-erasure", {"confirmation": "ERASE MY DATA"}),
        (
            "post",
            f"/api/v1/subjects/{sid}/consents",
            {"scope": "research", "version": "x-1", "idempotencyKey": "caregiver-consent-1"},
        ),
        (
            "post",
            "/api/v1/sessions",
            {
                "subjectId": sid,
                "idempotencyKey": "caregiver-session-99",
                "activities": [{"activityCode": "cpt", "mode": "scored"}],
            },
        ),
        ("post", f"/api/v1/subjects/{sid}/reports", {"idempotencyKey": "caregiver-report-01"}),
        ("post", f"/api/v1/subjects/{sid}/caregivers", {"caregiverFirebaseUid": "someone-else"}),
        ("patch", f"/api/v1/subjects/{sid}", {"displayLabel": "renamed"}),
    ]
    for method, url, body in writes:
        response = getattr(client, method)(url, headers=CAREGIVER, json=body)
        assert response.status_code in (403, 404), (url, response.status_code)

    # Nothing changed.
    assert (
        client.get(f"/api/v1/subjects/{sid}/progress", headers=participant_headers).json()["summaryCount"]
        == 2
    )


def test_caregiver_views_appear_in_the_owners_access_log_as_another_account(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    sid = subject["id"]
    _share(client, participant_headers, sid)
    client.get(f"/api/v1/subjects/{sid}/progress", headers=CAREGIVER)
    client.get(f"/api/v1/subjects/{sid}/digital-twin", headers=CAREGIVER)

    log = client.get(f"/api/v1/subjects/{sid}/audit-events?limit=500", headers=participant_headers).json()[
        "items"
    ]

    foreign_actions = {entry["action"] for entry in log if not entry["actorIsYou"]}
    assert {"subject_progress_read", "digital_twin_read"} <= foreign_actions
    assert "caregiver-test-uid" not in json.dumps(log)
    own_actions = {entry["action"] for entry in log if entry["actorIsYou"]}
    assert "caregiver_access_granted" in own_actions


def test_caregiver_can_stop_viewing_using_the_relationship_id_they_were_given(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    sid = subject["id"]
    _share(client, participant_headers, sid)
    relationship_id = _shared_subjects(client)[0]["relationshipId"]

    revoked = client.delete(f"/api/v1/subjects/{sid}/caregivers/{relationship_id}", headers=CAREGIVER)

    assert revoked.status_code == 200
    assert revoked.json()["status"] == "revoked"
    assert _shared_subjects(client) == []
    assert client.get(f"/api/v1/subjects/{sid}/progress", headers=CAREGIVER).status_code == 404
    # The owner sees the relationship as revoked.
    relationships = client.get(f"/api/v1/subjects/{sid}/caregivers", headers=participant_headers).json()[
        "items"
    ]
    assert [item["status"] for item in relationships] == ["revoked"]


def test_owner_can_revoke_and_restore_access(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    sid = subject["id"]
    grant = _share(client, participant_headers, sid).json()

    client.delete(f"/api/v1/subjects/{sid}/caregivers/{grant['id']}", headers=participant_headers)
    assert _shared_subjects(client) == []
    assert client.get(f"/api/v1/subjects/{sid}/progress", headers=CAREGIVER).status_code == 404

    regrant = _share(client, participant_headers, sid)
    assert regrant.status_code == 201
    assert regrant.json()["id"] == grant["id"]  # stable relationship, not a duplicate
    assert [item["relationshipId"] for item in _shared_subjects(client)] == [grant["id"]]
    assert client.get(f"/api/v1/subjects/{sid}/progress", headers=CAREGIVER).status_code == 200


def test_only_the_owner_can_share_and_only_with_real_caregiver_accounts(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    sid = subject["id"]
    client.get("/api/v1/users/me", headers=OTHER)
    client.get("/api/v1/users/me", headers=CAREGIVER)

    # Another participant cannot share someone else's subject.
    stolen = client.post(
        f"/api/v1/subjects/{sid}/caregivers", headers=OTHER, json={"caregiverFirebaseUid": CAREGIVER_UID}
    )
    assert stolen.status_code == 404

    # A participant account or an unknown ID is not a caregiver.
    for uid in ("other-participant-test-uid", "no-such-user"):
        response = client.post(
            f"/api/v1/subjects/{sid}/caregivers",
            headers=participant_headers,
            json={"caregiverFirebaseUid": uid},
        )
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "caregiver_not_found"

    assert _shared_subjects(client) == []


def test_sharing_survives_data_erasure_and_keeps_the_caregiver_out_of_new_data(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    sid = subject["id"]
    _share(client, participant_headers, sid)

    client.post(
        f"/api/v1/subjects/{sid}/data-erasure",
        headers=participant_headers,
        json={"confirmation": "ERASE MY DATA"},
    )

    # The share remains (it is not research data), but there is nothing left to see.
    assert len(_shared_subjects(client)) == 1
    assert client.get(f"/api/v1/subjects/{sid}/progress", headers=CAREGIVER).json()["summaryCount"] == 0
    assert client.get(f"/api/v1/sessions?subjectId={sid}", headers=CAREGIVER).json()["items"] == []
