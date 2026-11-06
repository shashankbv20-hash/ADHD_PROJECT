from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends

from app.auth.dependencies import CurrentUser
from app.repositories.dependencies import get_repository
from app.repositories.firestore import Repository, path
from app.schemas import UserProfileUpdate, UserRead

router = APIRouter(prefix="/users", tags=["users"])


def _audit(repository: Repository, current_user: CurrentUser, action: str) -> None:
    repository.set(
        path("auditEvents", uuid4()),
        {
            "actor_uid": current_user.firebase_uid,
            "action": action,
            "resource_type": "user",
            "resource_id": current_user.firebase_uid,
            "details": {"fields": ["displayName"]} if action == "profile_updated" else {},
            "created_at": datetime.now(UTC),
        },
    )


def _profile(repository: Repository, current_user: CurrentUser) -> dict:
    uid = current_user.firebase_uid
    profile = repository.get(path("users", uid))
    if profile is None:
        now = datetime.now(UTC)
        profile = {
            "uid": uid,
            "displayName": current_user.display_name,
            "role": "participant",
            "cloudSyncEnabled": False,
            "createdAt": now,
            "updatedAt": now,
        }
        repository.set(path("users", uid), profile)
    # Role authorization comes exclusively from the verified token claim.
    return {
        "id": uid,
        "firebase_uid": uid,
        "display_name": profile.get("displayName"),
        "role": current_user.role,
        "created_at": profile.get("createdAt"),
    }


@router.get("/me", response_model=UserRead)
def read_current_user(
    current_user: CurrentUser,
    repository: Repository = Depends(get_repository),
) -> dict:
    profile = _profile(repository, current_user)
    _audit(repository, current_user, "profile_read")
    return profile


@router.patch("/me", response_model=UserRead)
def update_current_user(
    payload: UserProfileUpdate,
    current_user: CurrentUser,
    repository: Repository = Depends(get_repository),
) -> dict:
    profile = _profile(repository, current_user)
    updated_at = datetime.now(UTC)

    def update_profile(tx):
        tx.update(
            path("users", current_user.firebase_uid),
            {"displayName": payload.display_name, "updatedAt": updated_at},
        )
        tx.set(
            path("auditEvents", str(uuid4())),
            {
                "actor_uid": current_user.firebase_uid,
                "action": "profile_updated",
                "resource_type": "user",
                "resource_id": current_user.firebase_uid,
                "details": {"fields": ["displayName"]},
                "created_at": updated_at,
            },
        )

    repository.run_transaction(update_profile)
    return {**profile, "display_name": payload.display_name}
