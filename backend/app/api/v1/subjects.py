from datetime import UTC, datetime
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from fastapi import APIRouter, Depends

from app.auth.dependencies import CurrentUser
from app.core.errors import ApiError
from app.repositories.dependencies import get_repository
from app.repositories.firestore import Repository, path
from app.schemas import (
    CaregiverRelationshipCreate,
    CaregiverRelationshipList,
    CaregiverRelationshipRead,
    ConsentCreate,
    ConsentList,
    ConsentRead,
    SubjectCreate,
    SubjectList,
    SubjectRead,
    SubjectUpdate,
)
from app.services.authorization import audit_access, get_subject_for_user, require_participant_owner
from app.services.consent import withdraw_consent_record

router = APIRouter(prefix="/subjects", tags=["subjects", "consent"])


def _subject_read(subject):
    return {
        key: subject.get(key) for key in ("id", "display_label", "owner_user_id", "created_at", "is_active")
    }


@router.post("", response_model=SubjectRead, status_code=201)
def create_subject(
    payload: SubjectCreate, current_user: CurrentUser, repository: Repository = Depends(get_repository)
):
    if current_user.role != "participant":
        raise ApiError(
            403, "participant_role_required", "Only a participant account can create its subject record."
        )
    now, sid = datetime.now(UTC), str(uuid4())
    subject = {
        "display_label": payload.display_label,
        "owner_user_id": str(current_user.id),
        "created_at": now,
        "updated_at": now,
        "is_active": True,
    }

    def create(tx):
        tx.set(path("subjects", sid), subject)
        tx.set(
            path("auditEvents", str(uuid4())),
            {
                "actor_user_id": str(current_user.id),
                "subject_id": sid,
                "action": "subject_created",
                "resource_type": "subject",
                "resource_id": sid,
                "details": {},
                "created_at": now,
            },
        )

    repository.run_transaction(create)
    return _subject_read({"id": sid, **subject})


@router.get("", response_model=SubjectList)
def list_subjects(current_user: CurrentUser, repository: Repository = Depends(get_repository)):
    if current_user.role == "participant":
        subjects = repository.list(
            "subjects",
            filters=(("owner_user_id", "==", str(current_user.id)), ("is_active", "==", True)),
            order_by=("created_at", "desc"),
        )
    elif current_user.role == "caregiver":
        subjects = []
        index_records = repository.list(
            path("caregiverSubjectIndex", current_user.id, "subjects"),
            filters=(("status", "==", "active"),),
        )
        for index in index_records:
            subject_id = index.get("subject_id", index.id)
            subject = repository.get(path("subjects", subject_id))
            if subject and subject.get("is_active", True):
                try:
                    get_subject_for_user(repository, current_user, UUID(subject_id))
                except ApiError:
                    continue
                subjects.append(subject)
        subjects.sort(key=lambda s: s.get("created_at"), reverse=True)
    else:
        audit_access(
            repository,
            current_user,
            "subject_list_access_denied",
            "subject_collection",
            details={"role": current_user.role},
        )
        raise ApiError(
            403, "subject_assignment_required", "No subject assignment policy is configured for this role."
        )
    audit_access(
        repository,
        current_user,
        "subject_list_read",
        "subject_collection",
        details={"result_count": len(subjects)},
    )
    return {"items": [_subject_read(subject) for subject in subjects]}


@router.get("/{subject_id}", response_model=SubjectRead)
def read_subject(
    subject_id: UUID, current_user: CurrentUser, repository: Repository = Depends(get_repository)
):
    subject = get_subject_for_user(repository, current_user, subject_id)
    audit_access(
        repository,
        current_user,
        "subject_read",
        "subject",
        resource_id=str(subject_id),
        subject_id=subject_id,
    )
    return _subject_read(subject)


@router.patch("/{subject_id}", response_model=SubjectRead)
def update_subject(
    subject_id: UUID,
    payload: SubjectUpdate,
    current_user: CurrentUser,
    repository: Repository = Depends(get_repository),
):
    subject = get_subject_for_user(repository, current_user, subject_id, write=True)
    require_participant_owner(current_user, subject)
    now = datetime.now(UTC)

    def update_subject_record(tx):
        tx.update(
            path("subjects", subject_id),
            {"display_label": payload.display_label, "updated_at": now},
        )
        tx.set(
            path("auditEvents", str(uuid4())),
            {
                "actor_user_id": str(current_user.id),
                "subject_id": str(subject_id),
                "action": "subject_profile_updated",
                "resource_type": "subject",
                "resource_id": str(subject_id),
                "details": {"fields": ["display_label"]},
                "created_at": now,
            },
        )

    repository.run_transaction(update_subject_record)
    subject["display_label"] = payload.display_label
    subject["updated_at"] = now
    return _subject_read(subject)


@router.post("/{subject_id}/caregivers", response_model=CaregiverRelationshipRead, status_code=201)
def grant_caregiver_access(
    subject_id: UUID,
    payload: CaregiverRelationshipCreate,
    current_user: CurrentUser,
    repository: Repository = Depends(get_repository),
):
    subject = get_subject_for_user(repository, current_user, subject_id)
    require_participant_owner(current_user, subject)
    caregiver = repository.get(path("backendUsers", payload.caregiver_firebase_uid))
    if caregiver is None or caregiver.get("role") != "caregiver" or not caregiver.get("is_active", True):
        raise ApiError(404, "caregiver_not_found", "The authorized caregiver account was not found.")
    now, sid = datetime.now(UTC), str(subject_id)
    stable_relationship_id = str(uuid5(NAMESPACE_URL, f"caregiver:{sid}:{caregiver.id}"))
    stable_relationship_path = path("subjects", sid, "caregiverRelationships", stable_relationship_id)

    def grant(tx):
        matches = tx.list(
            path("subjects", sid, "caregiverRelationships"),
            filters=(("caregiver_user_id", "==", str(caregiver.id)),),
        )
        if matches:
            rel = matches[0]
            changed = rel.get("status") != "active" or rel.get("revoked_at") is not None
            if rel.get("status") != "active" or rel.get("revoked_at") is not None:
                tx.update(
                    path("subjects", sid, "caregiverRelationships", rel.id),
                    {"status": "active", "revoked_at": None, "granted_by_user_id": str(current_user.id)},
                )
                rel.update(
                    {"status": "active", "revoked_at": None, "granted_by_user_id": str(current_user.id)}
                )
            tx.set(
                path("caregiverSubjectIndex", caregiver.id, "subjects", sid),
                {
                    "subject_id": sid,
                    "relationship_id": rel.id,
                    "status": "active",
                    "updated_at": now,
                },
                merge=True,
            )
            if changed:
                tx.set(
                    path("auditEvents", str(uuid4())),
                    {
                        "actor_user_id": str(current_user.id),
                        "subject_id": sid,
                        "action": "caregiver_access_granted",
                        "resource_type": "caregiver_relationship",
                        "resource_id": rel.id,
                        "details": {},
                        "created_at": now,
                    },
                )
            return rel
        existing = tx.get(stable_relationship_path)
        if existing is not None:
            tx.update(
                stable_relationship_path,
                {"status": "active", "revoked_at": None, "granted_by_user_id": str(current_user.id)},
            )
            existing.update(
                {"status": "active", "revoked_at": None, "granted_by_user_id": str(current_user.id)}
            )
            tx.set(
                path("caregiverSubjectIndex", caregiver.id, "subjects", sid),
                {
                    "subject_id": sid,
                    "relationship_id": stable_relationship_id,
                    "status": "active",
                    "updated_at": now,
                },
                merge=True,
            )
            return existing
        rid = stable_relationship_id
        rel = {
            "caregiver_user_id": str(caregiver.id),
            "subject_id": sid,
            "granted_by_user_id": str(current_user.id),
            "status": "active",
            "created_at": now,
            "revoked_at": None,
        }
        tx.set(path("subjects", sid, "caregiverRelationships", rid), rel)
        tx.set(
            path("caregiverSubjectIndex", caregiver.id, "subjects", sid),
            {
                "subject_id": sid,
                "relationship_id": rid,
                "status": "active",
                "created_at": now,
                "updated_at": now,
            },
        )
        tx.set(
            path("auditEvents", str(uuid4())),
            {
                "actor_user_id": str(current_user.id),
                "subject_id": sid,
                "action": "caregiver_access_granted",
                "resource_type": "caregiver_relationship",
                "resource_id": rid,
                "details": {},
                "created_at": now,
            },
        )
        return {"id": rid, **rel}

    rel = repository.run_transaction(grant)
    return {
        key: rel.get(key)
        for key in ("id", "caregiver_user_id", "subject_id", "status", "created_at", "revoked_at")
    }


@router.get("/{subject_id}/caregivers", response_model=CaregiverRelationshipList)
def list_caregiver_relationships(
    subject_id: UUID, current_user: CurrentUser, repository: Repository = Depends(get_repository)
):
    subject = get_subject_for_user(repository, current_user, subject_id, write=True)
    require_participant_owner(current_user, subject)
    relationships = repository.list(
        path("subjects", subject_id, "caregiverRelationships"), order_by=("created_at", "desc")
    )
    audit_access(
        repository,
        current_user,
        "caregiver_relationships_read",
        "caregiver_relationship_collection",
        subject_id=subject_id,
        details={"result_count": len(relationships)},
    )
    # Only the declared fields: stored records also hold internal ones (e.g. granted_by_user_id),
    # which the strict response model rejects.
    return {
        "items": [
            {
                key: relationship.get(key)
                for key in ("id", "caregiver_user_id", "subject_id", "status", "created_at", "revoked_at")
            }
            for relationship in relationships
        ]
    }


@router.delete("/{subject_id}/caregivers/{relationship_id}", response_model=CaregiverRelationshipRead)
def revoke_caregiver_access(
    subject_id: UUID,
    relationship_id: UUID,
    current_user: CurrentUser,
    repository: Repository = Depends(get_repository),
):
    subject = get_subject_for_user(repository, current_user, subject_id)
    rp = path("subjects", subject_id, "caregiverRelationships", relationship_id)
    rel = repository.get(rp)
    if rel is None:
        raise ApiError(404, "caregiver_relationship_not_found", "The caregiver relationship was not found.")
    owner = current_user.role == "participant" and subject.get("owner_user_id") == str(current_user.id)
    self_revoke = current_user.role == "caregiver" and rel.get("caregiver_user_id") == str(current_user.id)
    if not owner and not self_revoke:
        raise ApiError(404, "caregiver_relationship_not_found", "The caregiver relationship was not found.")
    if rel.get("status") == "active":
        now = datetime.now(UTC)

        def revoke(tx):
            current = tx.get(rp)
            if current and current.get("status") == "active":
                tx.update(rp, {"status": "revoked", "revoked_at": now})
                current.update({"status": "revoked", "revoked_at": now})
                tx.set(
                    path(
                        "caregiverSubjectIndex",
                        current.get("caregiver_user_id"),
                        "subjects",
                        str(subject_id),
                    ),
                    {
                        "subject_id": str(subject_id),
                        "relationship_id": str(relationship_id),
                        "status": "revoked",
                        "updated_at": now,
                    },
                    merge=True,
                )
                tx.set(
                    path("auditEvents", str(uuid4())),
                    {
                        "actor_user_id": str(current_user.id),
                        "subject_id": str(subject_id),
                        "action": "caregiver_access_revoked",
                        "resource_type": "caregiver_relationship",
                        "resource_id": str(relationship_id),
                        "details": {},
                        "created_at": now,
                    },
                )
            return current

        rel = repository.run_transaction(revoke)
    return {
        key: rel.get(key)
        for key in ("id", "caregiver_user_id", "subject_id", "status", "created_at", "revoked_at")
    }


@router.post("/{subject_id}/consents", response_model=ConsentRead, status_code=201)
def record_consent(
    subject_id: UUID,
    payload: ConsentCreate,
    current_user: CurrentUser,
    repository: Repository = Depends(get_repository),
):
    subject = get_subject_for_user(repository, current_user, subject_id, write=True)
    require_participant_owner(current_user, subject)
    sid, now = str(subject_id), datetime.now(UTC)

    def grant(tx):
        collection = path("subjects", sid, "consents")
        scope_path = path("subjects", sid, "consentScopes", payload.scope)
        scope_state = tx.get(scope_path)
        prior = tx.list(
            collection,
            filters=(("scope", "==", payload.scope), ("idempotency_key", "==", payload.idempotency_key)),
        )
        if prior:
            winner = prior[0]
            if (
                winner.get("actor_user_id") == str(current_user.id)
                and winner.get("version") == payload.version
            ):
                return winner
            raise ApiError(
                409,
                "consent_idempotency_conflict",
                "This consent idempotency key was used for a different consent request.",
            )
        active = tx.list(collection, filters=(("scope", "==", payload.scope), ("status", "==", "granted")))
        current_consent_id = scope_state.get("current_consent_id") if scope_state else None
        if current_consent_id and all(item.id != current_consent_id for item in active):
            pointed = tx.get(path(collection, current_consent_id))
            if pointed and pointed.get("status") == "granted":
                active.append(pointed)
        for item in active:
            if item.get("withdrawn_at") is None:
                tx.update(path(collection, item.id), {"status": "superseded"})
        cid = str(uuid4())
        data = {
            "subject_id": sid,
            "actor_user_id": str(current_user.id),
            "scope": payload.scope,
            "version": payload.version,
            "idempotency_key": payload.idempotency_key,
            "status": "granted",
            "granted_at": now,
            "withdrawn_at": None,
            "created_at": now,
        }
        tx.set(path(collection, cid), data)
        tx.set(
            scope_path,
            {
                "scope": payload.scope,
                "current_consent_id": cid,
                "status": "granted",
                "updated_at": now,
            },
        )
        tx.set(
            path("auditEvents", str(uuid4())),
            {
                "actor_user_id": str(current_user.id),
                "subject_id": sid,
                "action": "consent_granted",
                "resource_type": "consent_record",
                "resource_id": cid,
                "details": {"scope": payload.scope, "version": payload.version},
                "created_at": now,
            },
        )
        return {"id": cid, **data}

    consent = repository.run_transaction(grant)
    return consent


@router.get("/{subject_id}/consents", response_model=ConsentList)
def list_consents(
    subject_id: UUID, current_user: CurrentUser, repository: Repository = Depends(get_repository)
):
    subject = get_subject_for_user(repository, current_user, subject_id, write=True)
    require_participant_owner(current_user, subject)
    consents = repository.list(path("subjects", subject_id, "consents"), order_by=("created_at", "desc"))
    audit_access(
        repository,
        current_user,
        "consent_records_read",
        "consent_collection",
        subject_id=subject_id,
        details={"result_count": len(consents)},
    )
    return {"items": consents}


@router.post("/{subject_id}/consents/{consent_id}/withdraw", response_model=ConsentRead)
def withdraw_consent(
    subject_id: UUID,
    consent_id: UUID,
    current_user: CurrentUser,
    repository: Repository = Depends(get_repository),
):
    subject = get_subject_for_user(repository, current_user, subject_id, write=True)
    require_participant_owner(current_user, subject)
    return withdraw_consent_record(repository, current_user, subject_id, consent_id)
