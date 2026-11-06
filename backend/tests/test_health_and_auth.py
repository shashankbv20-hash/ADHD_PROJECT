from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from tests.conftest import fake_token_verifier


def test_liveness_and_readiness_are_separate(test_app):
    _, client = test_app
    assert client.get("/health/live").status_code == 200
    assert client.get("/health/ready").status_code == 200


def test_missing_firestore_configuration_reports_not_ready_but_liveness_stays_healthy():
    app = create_app(Settings(firebase_project_id=None), token_verifier=fake_token_verifier, repository=None)
    with TestClient(app) as client:
        assert client.get("/health/live").status_code == 200
        response = client.get("/health/ready")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "firestore_not_configured"
        assert client.get("/api/v1/users/me").status_code == 401


def test_token_required_and_unknown_role_claim_fails_closed(test_app):
    _, client = test_app
    assert client.get("/api/v1/users/me").status_code == 401
    assert (
        client.get("/api/v1/users/me", headers={"Authorization": "Bearer not-a-test-token"}).status_code
        == 401
    )
    response = client.get("/api/v1/users/me", headers={"Authorization": "Bearer admin-token"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "unsupported_role_claim"


def test_missing_custom_role_defaults_to_participant_and_profile_is_idempotent(test_app, participant_headers):
    app, client = test_app
    first = client.get("/api/v1/users/me", headers=participant_headers)
    second = client.get("/api/v1/users/me", headers=participant_headers)
    assert first.status_code == second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["role"] == "participant"
    users = app.state.repository.list("backendUsers")
    assert len(users) == 1
    assert users[0]["firebase_uid"] == "participant-test-uid"


def test_profile_patch_cannot_assign_a_role(test_app, participant_headers):
    _, client = test_app
    assert client.get("/api/v1/users/me", headers=participant_headers).status_code == 200
    response = client.patch(
        "/api/v1/users/me",
        headers=participant_headers,
        json={"displayName": "Changed Name", "role": "researcher"},
    )
    assert response.status_code == 422
    profile = client.get("/api/v1/users/me", headers=participant_headers)
    assert profile.json()["role"] == "participant"


def test_unconfigured_integrations_are_reported_without_fake_outputs(test_app, participant_headers):
    _, client = test_app
    capabilities = client.get("/api/v1/capabilities")
    assert capabilities.status_code == 200
    body = capabilities.json()
    assert body["eeg"]["available"] is False
    assert body["webcam"]["available"] is False
    assert body["aiBuddy"]["available"] is False

    unavailable = client.post(
        "/api/v1/ai-buddy/messages",
        headers=participant_headers,
        json={"message": "Give me a task hint."},
    )
    assert unavailable.status_code == 503
    assert unavailable.json()["error"]["code"] == "ai_buddy_unavailable"
    assert "Give me a task hint." not in unavailable.text
