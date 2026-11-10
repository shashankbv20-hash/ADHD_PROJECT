"""End-to-end authentication tests against the Firebase Auth + Firestore emulators.

Unlike the rest of the suite (which injects a fake token verifier), these use the
real ``verify_firebase_id_token`` path: tokens are issued by the Auth emulator
and verified with Firebase Admin, including custom-claim roles and revocation.
Skipped unless FIREBASE_AUTH_EMULATOR_HOST is set (``scripts/run-emulator-tests.ps1``
and CI start the Auth and Firestore emulators). Persistence uses the Firestore
emulator when FIRESTORE_EMULATOR_HOST is also set, and the in-memory repository
otherwise, so the real-token checks can run with the Auth emulator alone. The
project ID is ``demo-attune-tests``, so no real Firebase project can be reached.
All accounts and data are synthetic.
"""

from __future__ import annotations

import os
import time
import uuid
from collections.abc import Iterator

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.repositories.firestore import FirestoreRepository, InMemoryRepository, Repository, path
from app.services.cpt_scoring import CPT_SCORED_STIMULI
from tests.conftest import EMULATOR_PROJECT_ID, _clear_emulator
from tests.test_sessions_and_analytics import _create_session, _create_subject, _events, _start_cpt

AUTH_HOST = os.environ.get("FIREBASE_AUTH_EMULATOR_HOST")
FIRESTORE_HOST = os.environ.get("FIRESTORE_EMULATOR_HOST")

pytestmark = pytest.mark.skipif(
    not AUTH_HOST,
    reason="Auth emulator is not running (FIREBASE_AUTH_EMULATOR_HOST is not set)",
)

PASSWORD = "synthetic-password-123"
IDENTITY_TOOLKIT = "identitytoolkit.googleapis.com/v1"


def _auth_url(action: str) -> str:
    return f"http://{AUTH_HOST}/{IDENTITY_TOOLKIT}/accounts:{action}?key=fake-api-key"


def _sign_up(email: str) -> tuple[str, str]:
    response = httpx.post(
        _auth_url("signUp"),
        json={"email": email, "password": PASSWORD, "returnSecureToken": True},
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    return data["idToken"], data["localId"]


def _sign_in(email: str) -> str:
    response = httpx.post(
        _auth_url("signInWithPassword"),
        json={"email": email, "password": PASSWORD, "returnSecureToken": True},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["idToken"]


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.test"


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_app():
    import firebase_admin

    name = "attune-test-admin"
    try:
        return firebase_admin.get_app(name)
    except ValueError:
        return firebase_admin.initialize_app(options={"projectId": EMULATOR_PROJECT_ID}, name=name)


@pytest.fixture
def real_auth_client() -> Iterator[tuple[Repository, TestClient]]:
    firestore_client = None
    repository: Repository
    if FIRESTORE_HOST:
        from google.auth.credentials import AnonymousCredentials
        from google.cloud import firestore

        _clear_emulator()
        firestore_client = firestore.Client(project=EMULATOR_PROJECT_ID, credentials=AnonymousCredentials())
        repository = FirestoreRepository(firestore_client)
    else:
        repository = InMemoryRepository()

    # No token_verifier: the app uses the real Firebase Admin verification path.
    settings = Settings(firebase_project_id=EMULATOR_PROJECT_ID, cors_origins="http://localhost:3000")
    app = create_app(settings, repository=repository)
    try:
        with TestClient(app) as client:
            yield repository, client
    finally:
        if firestore_client is not None:
            firestore_client.close()
            _clear_emulator()


def test_requests_without_a_valid_token_are_rejected(real_auth_client):
    _, client = real_auth_client

    missing = client.get("/api/v1/users/me")
    assert missing.status_code == 401
    assert missing.json()["error"]["code"] == "authentication_required"

    garbage = client.get("/api/v1/users/me", headers=_bearer("not-a-real-token"))
    assert garbage.status_code == 401
    assert garbage.json()["error"]["code"] == "invalid_bearer_token"


def test_a_real_emulator_token_provisions_a_participant_profile(real_auth_client):
    repository, client = real_auth_client
    token, uid = _sign_up(_unique_email("participant"))

    response = client.get("/api/v1/users/me", headers=_bearer(token))

    assert response.status_code == 200
    body = response.json()
    assert body["firebaseUid"] == uid
    assert body["role"] == "participant"
    # The frontend-compatible profile and the private role projection both exist.
    profile = repository.get(path("users", uid))
    assert profile is not None and profile["role"] == "participant" and profile["cloudSyncEnabled"] is False
    assert repository.get(path("backendUsers", uid)) is not None


def test_roles_come_only_from_trusted_custom_claims(real_auth_client, admin_app):
    from firebase_admin import auth

    _, client = real_auth_client
    email = _unique_email("clinician")
    _, uid = _sign_up(email)

    # Before any claim is set the account is a participant, whatever the client asks for.
    assert client.get("/api/v1/users/me", headers=_bearer(_sign_in(email))).json()["role"] == "participant"

    auth.set_custom_user_claims(uid, {"role": "clinician"}, app=admin_app)
    response = client.get("/api/v1/users/me", headers=_bearer(_sign_in(email)))

    assert response.status_code == 200
    assert response.json()["role"] == "clinician"


def test_an_unsupported_role_claim_fails_closed(real_auth_client, admin_app):
    from firebase_admin import auth

    _, client = real_auth_client
    email = _unique_email("admin")
    _, uid = _sign_up(email)
    auth.set_custom_user_claims(uid, {"role": "admin"}, app=admin_app)

    response = client.get("/api/v1/users/me", headers=_bearer(_sign_in(email)))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "unsupported_role_claim"


def test_revoked_sessions_are_rejected(real_auth_client, admin_app):
    from firebase_admin import auth

    _, client = real_auth_client
    token, uid = _sign_up(_unique_email("revoked"))
    assert client.get("/api/v1/users/me", headers=_bearer(token)).status_code == 200

    # Revocation has one-second granularity: make sure the token predates it.
    time.sleep(1.2)
    auth.revoke_refresh_tokens(uid, app=admin_app)

    response = client.get("/api/v1/users/me", headers=_bearer(token))
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_bearer_token"


def test_full_cpt_flow_with_real_tokens_and_cross_user_isolation(real_auth_client, admin_app):
    from firebase_admin import auth

    _, client = real_auth_client
    owner_token, _ = _sign_up(_unique_email("owner"))
    other_token, _ = _sign_up(_unique_email("other"))
    clinician_email = _unique_email("staff")
    _, clinician_uid = _sign_up(clinician_email)
    auth.set_custom_user_claims(clinician_uid, {"role": "clinician"}, app=admin_app)
    clinician_token = _sign_in(clinician_email)
    owner = _bearer(owner_token)

    client.get("/api/v1/users/me", headers=owner)
    subject = _create_subject(client, owner)
    session = _create_session(client, owner, subject["id"], "scored", "real-auth-run-01")
    assignment_id = _start_cpt(client, owner, session)

    ingested = client.post(
        f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch",
        headers=owner,
        json={"events": _events(CPT_SCORED_STIMULI, "scored")},
    )
    assert ingested.status_code == 200
    completed = client.post(
        f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/complete", headers=owner
    )
    assert completed.status_code == 200

    twin = client.get(f"/api/v1/subjects/{subject['id']}/digital-twin", headers=owner)
    assert twin.status_code == 200
    assert twin.json()["version"] == 1

    # Another participant and (until an assignment rule exists) a clinician are both denied.
    for token in (other_token, clinician_token):
        denied = client.get(f"/api/v1/subjects/{subject['id']}/progress", headers=_bearer(token))
        assert denied.status_code in (403, 404)
        listed = client.get("/api/v1/subjects", headers=_bearer(token))
        assert listed.status_code in (200, 403)
        if listed.status_code == 200:
            assert listed.json()["items"] == []


def test_set_role_tool_grants_a_caregiver_who_can_then_see_a_shared_subject(real_auth_client):
    """The administrator tool is the trusted path to a caregiver role; exercise it for real."""
    import subprocess
    import sys
    from pathlib import Path

    _, client = real_auth_client
    script = Path(__file__).resolve().parent.parent / "scripts" / "set_role.py"
    owner_token, _ = _sign_up(_unique_email("owner"))
    caregiver_email = _unique_email("caregiver")
    caregiver_token, caregiver_uid = _sign_up(caregiver_email)

    def run_tool(*extra: str):
        return subprocess.run(
            [sys.executable, str(script), "--project", EMULATOR_PROJECT_ID, "--uid", caregiver_uid, *extra],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )

    # Without --yes it must refuse and change nothing.
    refused = run_tool("--role", "caregiver")
    assert refused.returncode == 2
    assert client.get("/api/v1/users/me", headers=_bearer(caregiver_token)).json()["role"] == "participant"

    granted = run_tool("--role", "caregiver", "--yes")
    assert granted.returncode == 0, granted.stderr
    caregiver = _bearer(_sign_in(caregiver_email))  # a fresh token carries the new claim
    assert client.get("/api/v1/users/me", headers=caregiver).json()["role"] == "caregiver"

    # The owner shares a subject by the caregiver's ID; the caregiver sees it, read-only.
    owner = _bearer(owner_token)
    client.get("/api/v1/users/me", headers=owner)
    subject = _create_subject(client, owner)
    share = client.post(
        f"/api/v1/subjects/{subject['id']}/caregivers",
        headers=owner,
        json={"caregiverFirebaseUid": caregiver_uid},
    )
    assert share.status_code == 201, share.text
    shared = client.get("/api/v1/caregiver/subjects", headers=caregiver).json()["items"]
    assert [item["subjectId"] for item in shared] == [subject["id"]]
    assert client.get(f"/api/v1/subjects/{subject['id']}/export", headers=caregiver).status_code == 404

    # The tool can also remove the role again.
    removed = run_tool("--role", "participant", "--yes")
    assert removed.returncode == 0, removed.stderr
    assert (
        client.get("/api/v1/users/me", headers=_bearer(_sign_in(caregiver_email))).json()["role"]
        == "participant"
    )
