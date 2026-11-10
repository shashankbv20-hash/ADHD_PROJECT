from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth.dependencies import CurrentUser
from app.core.errors import ApiError
from app.repositories.dependencies import get_repository
from app.repositories.firestore import Repository, path
from app.schemas import SharedSubjectList
from app.services.authorization import audit_access, get_subject_for_user

router = APIRouter(prefix="/caregiver", tags=["caregiver"])


@router.get("/subjects", response_model=SharedSubjectList)
def shared_subjects(current_user: CurrentUser, repository: Repository = Depends(get_repository)) -> dict:
    """Subjects whose owner currently shares access with this caregiver.

    Includes the relationship ID, which the caregiver needs to stop viewing a subject
    (``DELETE /subjects/{id}/caregivers/{relationshipId}``). Revoked or inactive shares
    are not listed.
    """
    if current_user.role != "caregiver":
        raise ApiError(403, "caregiver_role_required", "Only a caregiver account can list shared subjects.")

    items = []
    for index in repository.list(
        path("caregiverSubjectIndex", current_user.id, "subjects"),
        filters=(("status", "==", "active"),),
    ):
        subject_id = index.get("subject_id", index.id)
        relationship_id = index.get("relationship_id")
        if not relationship_id:
            continue
        try:
            # Re-checks the live relationship, not just the index projection.
            subject = get_subject_for_user(repository, current_user, UUID(subject_id))
        except ApiError:
            continue
        relationship = repository.get(path("subjects", subject_id, "caregiverRelationships", relationship_id))
        if relationship is None or relationship.get("status") != "active":
            continue
        items.append(
            {
                "subject_id": UUID(subject_id),
                "display_label": subject.get("display_label"),
                "relationship_id": UUID(relationship_id),
                "shared_since": relationship.get("created_at"),
            }
        )

    items.sort(key=lambda item: (item["shared_since"] is not None, item["shared_since"]), reverse=True)
    audit_access(
        repository,
        current_user,
        "caregiver_shared_subjects_read",
        "caregiver_subject_collection",
        details={"result_count": len(items)},
    )
    return {"items": items}
