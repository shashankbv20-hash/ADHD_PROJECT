from datetime import UTC, datetime
from uuid import UUID, uuid4

from app.core.errors import ApiError
from app.repositories.firestore import Repository, path


def audit_access(
    repository: Repository,
    user,
    action: str,
    resource_type: str,
    *,
    resource_id: str | None = None,
    subject_id: UUID | str | None = None,
    details: dict | None = None,
) -> None:
    audit_id = str(uuid4())
    repository.set(
        path("auditEvents", audit_id),
        {
            "actor_user_id": str(user.id),
            "subject_id": str(subject_id) if subject_id else None,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details or {},
            "created_at": datetime.now(UTC),
        },
    )


def get_subject_for_user(repository: Repository, user, subject_id: UUID, *, write: bool = False):
    sid = str(subject_id)
    subject = repository.get(path("subjects", sid))
    if subject is None or not subject.get("is_active", True):
        audit_access(repository, user, "subject_access_not_found", "subject", resource_id=sid)
        raise ApiError(404, "subject_not_found", "The requested subject was not found.")
    if subject.get("owner_user_id") == str(user.id) and user.role == "participant":
        return subject
    if not write and user.role == "caregiver":
        index = repository.get(path("caregiverSubjectIndex", user.id, "subjects", sid))
        relationship_id = index.get("relationship_id") if index and index.get("status") == "active" else None
        relationship = (
            repository.get(path("subjects", sid, "caregiverRelationships", relationship_id))
            if relationship_id
            else None
        )
        if relationship and relationship.get("status") == "active" and relationship.get("revoked_at") is None:
            return subject
    audit_access(
        repository,
        user,
        "subject_access_denied",
        "subject",
        resource_id=sid,
        subject_id=sid,
        details={"write_requested": write},
    )
    raise ApiError(404, "subject_not_found", "The requested subject was not found.")


def require_participant_owner(user, subject) -> None:
    if user.role != "participant" or subject.get("owner_user_id") != str(user.id):
        raise ApiError(404, "subject_not_found", "The requested subject was not found.")


def has_active_consent(repository: Repository, subject_id: UUID | str, scope: str) -> bool:
    scope_state = repository.get(path("subjects", subject_id, "consentScopes", scope))
    if scope_state is not None:
        consent_id = scope_state.get("current_consent_id")
        current = repository.get(path("subjects", subject_id, "consents", consent_id)) if consent_id else None
        return bool(
            scope_state.get("status") == "granted"
            and current
            and current.get("status") == "granted"
            and current.get("granted_at") is not None
            and current.get("withdrawn_at") is None
        )
    consents = repository.list(
        path("subjects", subject_id, "consents"),
        filters=(("scope", "==", scope),),
        order_by=("created_at", "desc"),
        limit=1,
    )
    return bool(
        consents
        and consents[0].get("status") == "granted"
        and consents[0].get("granted_at") is not None
        and consents[0].get("withdrawn_at") is None
    )


def require_active_consent(repository: Repository, subject_id: UUID | str, scope: str) -> None:
    if not has_active_consent(repository, subject_id, scope):
        raise ApiError(
            403, "consent_required", f"An active '{scope}' consent is required for this operation."
        )
