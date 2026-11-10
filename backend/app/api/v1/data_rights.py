from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import CurrentUser
from app.repositories.dependencies import get_repository
from app.repositories.firestore import Repository
from app.schemas import AuditEventList, DataErasureRequest, DataErasureResult
from app.services.authorization import audit_access, get_subject_for_user, require_participant_owner
from app.services.data_rights import (
    erase_subject_data,
    export_subject_data,
    list_subject_audit_events,
)

router = APIRouter(prefix="/subjects", tags=["data-rights"])


def _owned_subject(repository: Repository, current_user, subject_id: UUID):
    # write=True excludes caregivers: export, erasure and the access log are owner-only.
    subject = get_subject_for_user(repository, current_user, subject_id, write=True)
    require_participant_owner(current_user, subject)
    return subject


@router.get("/{subject_id}/export", response_model=None)
def export_data(
    subject_id: UUID, current_user: CurrentUser, repository: Repository = Depends(get_repository)
) -> dict:
    """Everything stored for this subject, as the participant's own data export."""
    subject = _owned_subject(repository, current_user, subject_id)
    return export_subject_data(repository, subject, current_user)


@router.get("/{subject_id}/audit-events", response_model=AuditEventList)
def access_log(
    subject_id: UUID,
    current_user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    repository: Repository = Depends(get_repository),
) -> dict:
    """Recorded actions about this subject (consent, access, export, erasure)."""
    subject = _owned_subject(repository, current_user, subject_id)
    items = list_subject_audit_events(repository, str(subject.id), str(current_user.id), limit)
    audit_access(
        repository,
        current_user,
        "access_log_read",
        "audit_log",
        subject_id=subject.id,
        details={"result_count": len(items)},
    )
    return {"items": items}


@router.post("/{subject_id}/data-erasure", response_model=DataErasureResult)
def erase_data(
    subject_id: UUID,
    payload: DataErasureRequest,
    current_user: CurrentUser,
    repository: Repository = Depends(get_repository),
) -> dict:
    """Withdraw consent and permanently delete this subject's research data.

    Keeps the subject record, consent history and audit log. Irreversible; safe to repeat.
    """
    subject = _owned_subject(repository, current_user, subject_id)
    return erase_subject_data(repository, subject, current_user)
