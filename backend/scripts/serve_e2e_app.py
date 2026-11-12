"""Serve the API for live end-to-end browser tests (frontend ``npm run test:e2e:live``).

Real Firebase ID tokens are verified against the Firebase Auth *emulator* (set
FIREBASE_AUTH_EMULATOR_HOST), while data lives in the in-memory repository. The Firestore
adapter itself is covered by the emulator pytest suite. Refuses to start unless the project ID
starts with ``demo-`` and the Auth emulator is configured, so it can never run against a real
Firebase project.

    python scripts/serve_e2e_app.py --port 8200
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import uvicorn

from app.core.config import Settings
from app.main import create_app
from app.repositories.firestore import InMemoryRepository


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8200)
    parser.add_argument("--cors-origin", default="http://127.0.0.1:3200")
    args = parser.parse_args()

    project_id = os.environ.get("FIREBASE_PROJECT_ID", "")
    if not project_id.startswith("demo-"):
        raise SystemExit("Refusing to start: FIREBASE_PROJECT_ID must start with 'demo-'.")
    if not os.environ.get("FIREBASE_AUTH_EMULATOR_HOST"):
        raise SystemExit("Refusing to start: FIREBASE_AUTH_EMULATOR_HOST is not set.")

    settings = Settings(
        firebase_project_id=project_id,
        cors_origins=args.cors_origin,
        rate_limit_per_minute=0,
        rate_limit_ip_per_minute=0,
    )
    app = create_app(settings, repository=InMemoryRepository())
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")


if __name__ == "__main__":
    main()
