"""Serve the API with FAKE authentication and an in-memory store, for contract tests ONLY.

The frontend contract test (frontend/src/lib/backend/contract.test.ts) runs the
real TypeScript client against this server. It accepts fixed fake bearer tokens
instead of verifying Firebase ID tokens, so it must never be deployed or exposed.
It refuses to start unless ATTUNE_ALLOW_FAKE_AUTH=1 is set explicitly.

    $env:ATTUNE_ALLOW_FAKE_AUTH = "1"
    python scripts/serve_test_app.py --port 8765
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Allow `python scripts/serve_test_app.py` from backend/ without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import uvicorn

from app.core.config import Settings
from app.core.errors import ApiError
from app.main import create_app
from app.repositories.firestore import InMemoryRepository

FAKE_TOKENS = {
    "participant-token": {"uid": "participant-test-uid", "name": "Synthetic Participant"},
    "other-participant-token": {"uid": "other-participant-test-uid", "name": "Other Participant"},
    "caregiver-token": {"uid": "caregiver-test-uid", "name": "Synthetic Caregiver", "role": "caregiver"},
}


def fake_token_verifier(token: str, project_id: str | None) -> dict:
    claims = FAKE_TOKENS.get(token)
    if claims is None:
        raise ApiError(401, "invalid_bearer_token", "The Firebase ID token is invalid or expired.")
    return claims


def main() -> None:
    if os.environ.get("ATTUNE_ALLOW_FAKE_AUTH") != "1":
        raise SystemExit(
            "Refusing to start: this server uses fake auth. Set ATTUNE_ALLOW_FAKE_AUTH=1 to confirm."
        )

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    # Rate limiting is off: the contract suite makes hundreds of requests as the same fake users.
    settings = Settings(
        firebase_project_id="demo-contract-tests",
        cors_origins="http://localhost:3000",
        rate_limit_per_minute=0,
        rate_limit_ip_per_minute=0,
    )
    app = create_app(settings, token_verifier=fake_token_verifier, repository=InMemoryRepository())
    # Loopback only: never bind a fake-auth server to a reachable interface.
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
