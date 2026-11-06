from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import uuid4

from fastapi import Depends, Header, Request

from app.core.errors import ApiError
from app.repositories.dependencies import get_repository
from app.repositories.firestore import Document, Repository, path

logger = logging.getLogger(__name__)
TokenVerifier = Callable[[str, str | None], dict[str, Any]]

ROLE_CLAIM_MAP = {
    "participant": "participant",
    "child": "participant",
    "caregiver": "caregiver",
    "clinician": "clinician",
    "researcher": "researcher",
}


@dataclass(frozen=True)
class Identity:
    uid: str
    role: str
    display_name: str | None


def parse_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise ApiError(401, "authentication_required", "A Firebase Bearer token is required.")
    scheme, separator, token = authorization.partition(" ")
    if not separator or scheme.lower() != "bearer" or not token.strip():
        raise ApiError(401, "invalid_authorization_header", "Use Authorization: Bearer <Firebase ID token>.")
    return token.strip()


def identity_from_claims(claims: dict[str, Any]) -> Identity:
    uid = claims.get("uid") or claims.get("sub")
    if not isinstance(uid, str) or not uid.strip():
        raise ApiError(401, "invalid_bearer_token", "The verified token has no user identifier.")

    raw_role = claims.get("role")
    if raw_role is None:
        role = "participant"
    elif isinstance(raw_role, str) and raw_role in ROLE_CLAIM_MAP:
        role = ROLE_CLAIM_MAP[raw_role]
    else:
        raise ApiError(403, "unsupported_role_claim", "The account has an unsupported trusted role claim.")

    display_name = claims.get("name")
    if not isinstance(display_name, str) or not display_name.strip():
        display_name = None
    else:
        display_name = display_name.strip()[:120]
    return Identity(uid=uid, role=role, display_name=display_name)


def provision_user(repository: Repository, identity: Identity) -> Document:
    """Provision a frontend-compatible profile and a private trusted-role projection."""
    profile_path = path("users", identity.uid)
    role_path = path("backendUsers", identity.uid)
    now = datetime.now(UTC)

    def provision(tx):
        profile = tx.get(profile_path)
        private = tx.get(role_path)
        if profile is None:
            profile_data = {
                "uid": identity.uid,
                "displayName": identity.display_name or "Participant",
                "role": "participant",
                "cloudSyncEnabled": False,
                "createdAt": now,
                "updatedAt": now,
            }
            tx.set(profile_path, profile_data)
            profile = Document(document_id=identity.uid, **profile_data)
        else:
            if (
                profile.get("uid") != identity.uid
                or profile.get("role") != "participant"
                or not isinstance(profile.get("cloudSyncEnabled"), bool)
                or not isinstance(profile.get("displayName"), str)
                or not profile.get("displayName", "").strip()
            ):
                raise ApiError(
                    409,
                    "profile_schema_conflict",
                    "The existing Firebase profile does not match the supported profile schema.",
                )
        previous_role = private.get("role") if private else None
        tx.set(
            role_path,
            {
                "uid": identity.uid,
                "firebase_uid": identity.uid,
                "role": identity.role,
                "display_name": identity.display_name or profile.get("displayName"),
                "is_active": True,
                "updated_at": now,
                "created_at": private.get("created_at", now) if private else now,
            },
            merge=True,
        )
        if previous_role is not None and previous_role != identity.role:
            tx.set(
                path("auditEvents", str(uuid4())),
                {
                    "actor_uid": identity.uid,
                    "action": "trusted_role_claim_synced",
                    "resource_type": "user",
                    "resource_id": identity.uid,
                    "details": {"previous_role": previous_role, "current_role": identity.role},
                    "created_at": now,
                },
            )
        return profile

    profile = repository.run_transaction(provision)
    return Document(
        document_id=identity.uid,
        uid=identity.uid,
        firebase_uid=identity.uid,
        role=identity.role,
        display_name=profile.get("displayName"),
        is_active=True,
        created_at=profile.get("createdAt"),
        updated_at=profile.get("updatedAt"),
        cloud_sync_enabled=profile.get("cloudSyncEnabled", False),
    )


def get_verified_identity(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> Identity:
    token = parse_bearer_token(authorization)
    verifier: TokenVerifier = request.app.state.token_verifier
    claims = verifier(token, request.app.state.settings.firebase_project_id)
    return identity_from_claims(claims)


VerifiedIdentity = Annotated[Identity, Depends(get_verified_identity)]


def get_current_user(
    identity: VerifiedIdentity,
    repository: Repository = Depends(get_repository),
) -> Document:
    return provision_user(repository, identity)


CurrentUser = Annotated[Document, Depends(get_current_user)]
