from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import ApiError
from app.main import create_app
from app.repositories.firestore import InMemoryRepository

TEST_TOKENS = {
    "participant-token": {"uid": "participant-test-uid", "name": "Synthetic Participant"},
    "other-participant-token": {"uid": "other-participant-test-uid"},
    "caregiver-token": {"uid": "caregiver-test-uid", "role": "caregiver", "name": "Synthetic Caregiver"},
    "clinician-token": {"uid": "clinician-test-uid", "role": "clinician"},
    "researcher-token": {"uid": "researcher-test-uid", "role": "researcher"},
    "admin-token": {"uid": "untrusted-admin-test-uid", "role": "admin"},
}


def fake_token_verifier(token: str, project_id: str | None) -> dict:
    if token not in TEST_TOKENS:
        raise ApiError(401, "invalid_bearer_token", "The Firebase ID token is invalid or expired.")
    return TEST_TOKENS[token]


@pytest.fixture
def test_app() -> Iterator[tuple[object, TestClient]]:
    settings = Settings(
        firebase_project_id="test-project",
        cors_origins="http://localhost:3000",
    )
    repository = InMemoryRepository()
    app = create_app(settings, token_verifier=fake_token_verifier, repository=repository)
    with TestClient(app) as client:
        yield app, client


@pytest.fixture
def participant_headers() -> dict[str, str]:
    return {"Authorization": "Bearer participant-token"}
