def register(client, token: str) -> dict:
    response = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    return response.json()


def create_subject(client, headers: dict[str, str]) -> dict:
    response = client.post("/api/v1/subjects", headers=headers, json={"displayLabel": "Synthetic subject A"})
    assert response.status_code == 201
    return response.json()


def test_subject_owner_and_trusted_caregiver_access(test_app, participant_headers):
    _, client = test_app
    owner = register(client, "participant-token")
    caregiver = register(client, "caregiver-token")
    subject = create_subject(client, participant_headers)

    owner_read = client.get(f"/api/v1/subjects/{subject['id']}", headers=participant_headers)
    assert owner_read.status_code == 200
    assert owner_read.json()["ownerUserId"] == owner["id"]

    # A public role supplied in a request is rejected; a caregiver account must
    # have a trusted Firebase custom claim provisioned outside the browser.
    grant = client.post(
        f"/api/v1/subjects/{subject['id']}/caregivers",
        headers=participant_headers,
        json={"caregiverFirebaseUid": caregiver["firebaseUid"]},
    )
    assert grant.status_code == 201
    caregiver_headers = {"Authorization": "Bearer caregiver-token"}
    assert client.get(f"/api/v1/subjects/{subject['id']}", headers=caregiver_headers).status_code == 200

    forbidden_write = client.post(
        "/api/v1/sessions",
        headers=caregiver_headers,
        json={
            "subjectId": subject["id"],
            "idempotencyKey": "caregiver-session-01",
            "activities": [{"activityCode": "cpt", "mode": "scored"}],
        },
    )
    assert forbidden_write.status_code == 404

    revoked = client.delete(
        f"/api/v1/subjects/{subject['id']}/caregivers/{grant.json()['id']}",
        headers=caregiver_headers,
    )
    assert revoked.status_code == 200
    assert revoked.json()["status"] == "revoked"
    assert client.get(f"/api/v1/subjects/{subject['id']}", headers=caregiver_headers).status_code == 404

    other_headers = {"Authorization": "Bearer other-participant-token"}
    assert client.get(f"/api/v1/subjects/{subject['id']}", headers=other_headers).status_code == 404


def test_consent_is_versioned_idempotent_and_withdrawable(test_app, participant_headers):
    _, client = test_app
    subject = create_subject(client, participant_headers)
    subject = client.get("/api/v1/subjects", headers=participant_headers).json()["items"][0]
    url = f"/api/v1/subjects/{subject['id']}/consents"
    payload = {
        "scope": "research",
        "version": "protocol-v1",
        "idempotencyKey": "consent-protocol-v1-01",
    }

    first = client.post(url, headers=participant_headers, json=payload)
    repeated = client.post(url, headers=participant_headers, json=payload)
    assert first.status_code == repeated.status_code == 201
    assert first.json()["id"] == repeated.json()["id"]
    assert first.json()["status"] == "granted"
    conflicting_retry = client.post(
        url,
        headers=participant_headers,
        json={
            "scope": "research",
            "version": "protocol-other",
            "idempotencyKey": payload["idempotencyKey"],
        },
    )
    assert conflicting_retry.status_code == 409

    replacement = client.post(
        url,
        headers=participant_headers,
        json={
            "scope": "research",
            "version": "protocol-v2",
            "idempotencyKey": "consent-protocol-v2-01",
        },
    )
    assert replacement.status_code == 201
    assert replacement.json()["status"] == "granted"
    records = client.get(url, headers=participant_headers).json()["items"]
    status_by_version = {item["version"]: item["status"] for item in records}
    assert status_by_version == {"protocol-v1": "superseded", "protocol-v2": "granted"}

    withdrawn = client.post(f"{url}/{replacement.json()['id']}/withdraw", headers=participant_headers)
    assert withdrawn.status_code == 200
    assert withdrawn.json()["status"] == "withdrawn"
    assert withdrawn.json()["withdrawnAt"] is not None
    blocked = client.post(
        "/api/v1/sessions",
        headers=participant_headers,
        json={
            "subjectId": subject["id"],
            "idempotencyKey": "withdrawn-consent-01",
            "activities": [{"activityCode": "cpt", "mode": "scored"}],
        },
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "consent_required"


def test_subject_creation_is_participant_only(test_app):
    _, client = test_app
    response = client.post(
        "/api/v1/subjects",
        headers={"Authorization": "Bearer researcher-token"},
        json={"displayLabel": "Not allowed"},
    )
    assert response.status_code == 403
