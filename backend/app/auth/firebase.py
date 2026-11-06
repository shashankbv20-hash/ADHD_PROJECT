from __future__ import annotations

from functools import lru_cache
from typing import Any

import firebase_admin
from firebase_admin import auth
from firebase_admin.exceptions import FirebaseError
from google.auth.exceptions import DefaultCredentialsError, GoogleAuthError

from app.core.errors import ApiError

APP_NAME = "attune-fastapi"


@lru_cache(maxsize=4)
def _get_firebase_app(project_id: str) -> firebase_admin.App:
    try:
        app = firebase_admin.get_app(APP_NAME)
        if app.project_id and app.project_id != project_id:
            raise ApiError(
                503,
                "firebase_project_mismatch",
                "Firebase token verification is configured for a different project.",
            )
        return app
    except ValueError:
        try:
            return firebase_admin.initialize_app(
                options={"projectId": project_id},
                name=APP_NAME,
            )
        except (DefaultCredentialsError, GoogleAuthError) as exc:
            raise ApiError(
                503,
                "firebase_credentials_unavailable",
                "Firebase token verification is not configured on this server.",
            ) from exc


def verify_firebase_id_token(token: str, project_id: str | None) -> dict[str, Any]:
    if not project_id:
        raise ApiError(
            503,
            "firebase_project_not_configured",
            "Firebase token verification is not configured on this server.",
        )
    try:
        app = _get_firebase_app(project_id)
        claims = auth.verify_id_token(token, app=app, check_revoked=True)
    except ApiError:
        raise
    except (auth.InvalidIdTokenError, auth.ExpiredIdTokenError, auth.RevokedIdTokenError) as exc:
        raise ApiError(401, "invalid_bearer_token", "The Firebase ID token is invalid or expired.") from exc
    except (DefaultCredentialsError, GoogleAuthError) as exc:
        raise ApiError(
            503,
            "firebase_credentials_unavailable",
            "Firebase token verification is not configured on this server.",
        ) from exc
    except Exception as exc:
        # Firebase SDK error text may contain request details; return safe text only.
        if isinstance(exc, FirebaseError):
            raise ApiError(
                401, "invalid_bearer_token", "The Firebase ID token could not be verified."
            ) from exc
        raise ApiError(
            503, "firebase_verifier_unavailable", "Firebase token verification is temporarily unavailable."
        ) from exc
    return claims
