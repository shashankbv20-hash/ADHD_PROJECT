"""Shared fixtures.

Every API/repository test runs against the in-memory repository. When the
Firestore emulator is available (``FIRESTORE_EMULATOR_HOST`` is set, e.g. via
``firebase emulators:exec`` — see backend/README.md), the same tests also run
against the real Firestore Admin adapter, so emulator-only behaviour
(transactions, ordering, cursors, timestamp types) is verified with the same
assertions. Without the emulator those parametrizations are skipped.
"""

import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import ApiError
from app.main import create_app
from app.repositories.firestore import FirestoreRepository, InMemoryRepository

EMULATOR_PROJECT_ID = "demo-attune-tests"
EMULATOR_HOST = os.environ.get("FIRESTORE_EMULATOR_HOST")

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


def pytest_report_header(config) -> str:
    if EMULATOR_HOST:
        return f"firestore emulator: {EMULATOR_HOST} (project {EMULATOR_PROJECT_ID})"
    return "firestore emulator: not configured (emulator parametrizations will be skipped)"


def _clear_emulator() -> None:
    import httpx

    url = f"http://{EMULATOR_HOST}/emulator/v1/projects/{EMULATOR_PROJECT_ID}/databases/(default)/documents"
    httpx.delete(url, timeout=30).raise_for_status()


@pytest.fixture(
    params=[
        "memory",
        pytest.param(
            "emulator",
            marks=pytest.mark.skipif(
                not EMULATOR_HOST, reason="FIRESTORE_EMULATOR_HOST is not set (no Firestore emulator)"
            ),
        ),
    ]
)
def repository(request) -> Iterator[object]:
    if request.param == "memory":
        yield InMemoryRepository()
        return

    from google.auth.credentials import AnonymousCredentials
    from google.cloud import firestore

    _clear_emulator()
    client = firestore.Client(project=EMULATOR_PROJECT_ID, credentials=AnonymousCredentials())
    try:
        yield FirestoreRepository(client)
    finally:
        client.close()
        _clear_emulator()


@pytest.fixture
def test_app(repository) -> Iterator[tuple[object, TestClient]]:
    settings = Settings(
        firebase_project_id="test-project",
        cors_origins="http://localhost:3000",
    )
    app = create_app(settings, token_verifier=fake_token_verifier, repository=repository)
    with TestClient(app) as client:
        yield app, client


@pytest.fixture
def participant_headers() -> dict[str, str]:
    return {"Authorization": "Bearer participant-token"}
