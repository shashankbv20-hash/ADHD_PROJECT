from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import CurrentUser
from app.core.errors import ApiError
from app.repositories.dependencies import get_repository
from app.repositories.firestore import Repository, path
from app.schemas import (
    ActivitySummaryRead,
    EventBatchRequest,
    EventBatchResponse,
    FeelingCheckInCreate,
    FeelingCheckInRead,
    SessionCreate,
    SessionList,
    SessionRead,
)
from app.services.authorization import audit_access, get_subject_for_user, require_active_consent
from app.services.pagination import decode_created_cursor, encode_created_cursor
from app.services.sessions import (
    add_cpt_events,
    cancel_session,
    complete_activity,
    create_session,
    get_session,
    pause_session,
    resume_session,
    skip_activity,
    start_activity,
    start_session,
)

router = APIRouter(prefix="/sessions", tags=["sessions", "activities"])


def _items(repo, sid, session):
    activities = repo.list(
        path("subjects", sid, "sessions", session.id, "activities"), order_by=("position", "asc")
    )
    return {
        "id": UUID(session.id),
        "subject_id": UUID(sid),
        "status": session.status,
        "created_at": session.created_at,
        "started_at": session.get("started_at"),
        "completed_at": session.get("completed_at"),
        "activities": [
            {
                "id": UUID(a.id),
                "activity_code": a.activity_code,
                "position": a.position,
                "status": a.status,
                "mode": a.mode,
                "started_at": a.get("started_at"),
                "completed_at": a.get("completed_at"),
            }
            for a in activities
        ],
    }


@router.post("", response_model=SessionRead, status_code=201)
def create_session_route(
    payload: SessionCreate, current_user: CurrentUser, repo: Repository = Depends(get_repository)
):
    return create_session(repo, current_user, payload)


@router.get("", response_model=SessionList)
def list_sessions(
    current_user: CurrentUser,
    subject_id: Annotated[UUID, Query(alias="subjectId")],
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = None,
    repo: Repository = Depends(get_repository),
):
    subject = get_subject_for_user(repo, current_user, subject_id)
    sid = str(subject.id)
    cursor_created = None
    cursor_id = None
    if cursor:
        cursor_created, cursor_id = decode_created_cursor(cursor)
    records = repo.page(
        path("subjects", sid, "sessions"),
        order_by="created_at",
        descending=True,
        after=(cursor_created, str(cursor_id)) if cursor_created and cursor_id else None,
        limit=limit + 1,
    )
    more = len(records) > limit
    records = records[:limit]
    results = [_items(repo, sid, r) for r in records]
    audit_access(
        repo,
        current_user,
        "sessions_list_read",
        "session_collection",
        subject_id=sid,
        details={"result_count": len(results)},
    )
    nxt = encode_created_cursor(records[-1].created_at, UUID(records[-1].id)) if more and records else None
    return {"items": results, "next_cursor": nxt}


@router.get("/{session_id}", response_model=SessionRead)
def read_session(session_id: UUID, current_user: CurrentUser, repo: Repository = Depends(get_repository)):
    session = get_session(repo, current_user, session_id)
    sid = str(session.subject_id)
    audit_access(repo, current_user, "session_read", "session", resource_id=str(session_id), subject_id=sid)
    return _items(repo, sid, session)


@router.post("/{session_id}/start", response_model=SessionRead)
def start_session_route(
    session_id: UUID, current_user: CurrentUser, repo: Repository = Depends(get_repository)
):
    return start_session(repo, current_user, session_id)


@router.post("/{session_id}/pause", response_model=SessionRead)
def pause_session_route(
    session_id: UUID, current_user: CurrentUser, repo: Repository = Depends(get_repository)
):
    return pause_session(repo, current_user, session_id)


@router.post("/{session_id}/resume", response_model=SessionRead)
def resume_session_route(
    session_id: UUID, current_user: CurrentUser, repo: Repository = Depends(get_repository)
):
    return resume_session(repo, current_user, session_id)


@router.post("/{session_id}/cancel", response_model=SessionRead)
def cancel_session_route(
    session_id: UUID, current_user: CurrentUser, repo: Repository = Depends(get_repository)
):
    return cancel_session(repo, current_user, session_id)


@router.post("/{session_id}/complete", response_model=SessionRead)
def complete_session_route(
    session_id: UUID, current_user: CurrentUser, repo: Repository = Depends(get_repository)
):
    session = get_session(repo, current_user, session_id, write=True)
    sid = str(session.subject_id)
    if session.status == "completed":
        return _items(repo, sid, session)
    now = datetime.now(UTC)
    session_path = path("subjects", sid, "sessions", str(session_id))
    activity_path = path("subjects", sid, "sessions", str(session_id), "activities")

    def f(tx):
        current = tx.get(session_path)
        if current is None:
            raise ApiError(404, "session_not_found", "The requested session was not found.")
        if current.status == "completed":
            return
        if current.status != "active":
            raise ApiError(
                409, "invalid_session_transition", f"Cannot complete a session in '{current.status}' state."
            )
        consents = tx.list(path("subjects", sid, "consents"), filters=(("scope", "==", "research"),))
        latest = max(consents, key=lambda item: (item.get("created_at"), item.id), default=None)
        if not latest or latest.get("status") != "granted" or latest.get("withdrawn_at") is not None:
            raise ApiError(
                403, "consent_required", "An active 'research' consent is required for this operation."
            )
        assignments = tx.list(activity_path)
        if not assignments or any(item.status not in {"completed", "skipped"} for item in assignments):
            raise ApiError(
                409,
                "session_activities_incomplete",
                "Complete or skip every assigned activity before completing the session.",
            )
        tx.update(session_path, {"status": "completed", "completed_at": now, "updated_at": now})
        tx.set(
            path("auditEvents", str(uuid4())),
            {
                "actor_user_id": str(current_user.id),
                "subject_id": sid,
                "action": "session_completed",
                "resource_type": "session",
                "resource_id": str(session_id),
                "details": {"assignment_count": len(assignments)},
                "created_at": now,
            },
        )

    repo.run_transaction(f)
    return _items(repo, sid, repo.get(path("subjects", sid, "sessions", str(session_id))))


@router.post("/{session_id}/activities/{assignment_id}/start", response_model=SessionRead)
def start_activity_route(
    session_id: UUID,
    assignment_id: UUID,
    current_user: CurrentUser,
    repo: Repository = Depends(get_repository),
):
    return start_activity(repo, current_user, session_id, assignment_id)


@router.post("/{session_id}/activities/{assignment_id}/events:batch", response_model=EventBatchResponse)
def ingest_activity_events(
    session_id: UUID,
    assignment_id: UUID,
    payload: EventBatchRequest,
    current_user: CurrentUser,
    repo: Repository = Depends(get_repository),
):
    return add_cpt_events(repo, current_user, session_id, assignment_id, payload.events)


@router.post("/{session_id}/activities/{assignment_id}/complete", response_model=SessionRead)
def complete_activity_route(
    session_id: UUID,
    assignment_id: UUID,
    current_user: CurrentUser,
    repo: Repository = Depends(get_repository),
):
    return complete_activity(repo, current_user, session_id, assignment_id)


@router.post("/{session_id}/activities/{assignment_id}/skip", response_model=SessionRead)
def skip_activity_route(
    session_id: UUID,
    assignment_id: UUID,
    current_user: CurrentUser,
    repo: Repository = Depends(get_repository),
):
    return skip_activity(repo, current_user, session_id, assignment_id)


@router.post("/{session_id}/feeling-checkins", response_model=FeelingCheckInRead, status_code=201)
def create_feeling_checkin(
    session_id: UUID,
    payload: FeelingCheckInCreate,
    current_user: CurrentUser,
    repo: Repository = Depends(get_repository),
):
    session = get_session(repo, current_user, session_id, write=True)
    sid = str(session.subject_id)
    if current_user.role != "participant":
        raise ApiError(
            403, "participant_role_required", "Only the participant can record a feeling check-in."
        )
    require_active_consent(repo, sid, "research")
    p = path("subjects", sid, "sessions", str(session_id), "feelingCheckIns", payload.phase)
    now = datetime.now(UTC)
    checkin_id = str(uuid4())
    data = {
        "session_id": str(session_id),
        "actor_user_id": str(current_user.id),
        "phase": payload.phase,
        "mood_rating": payload.mood_rating,
        "energy_rating": payload.energy_rating,
        "recorded_at": now,
        "id": checkin_id,
    }

    def f(tx):
        consents = tx.list(path("subjects", sid, "consents"), filters=(("scope", "==", "research"),))
        latest = max(consents, key=lambda item: (item.get("created_at"), item.id), default=None)
        if not latest or latest.get("status") != "granted" or latest.get("withdrawn_at") is not None:
            raise ApiError(
                403, "consent_required", "An active 'research' consent is required for this operation."
            )
        existing = tx.get(p)
        if existing:
            if (
                existing.actor_user_id == str(current_user.id)
                and existing.mood_rating == payload.mood_rating
                and existing.energy_rating == payload.energy_rating
            ):
                return existing
            raise ApiError(409, "feeling_checkin_exists", "A check-in already exists for this session phase.")
        tx.set(p, data)
        tx.set(
            path("auditEvents", str(uuid4())),
            {
                "actor_user_id": str(current_user.id),
                "subject_id": sid,
                "action": "feeling_checkin_recorded",
                "resource_type": "session",
                "resource_id": str(session_id),
                "details": {"phase": payload.phase},
                "created_at": now,
            },
        )
        return None

    existing = repo.run_transaction(f)
    return {
        "id": UUID(existing.get("id", existing.id)) if existing else UUID(checkin_id),
        "session_id": UUID(session_id),
        "phase": payload.phase,
        "mood_rating": payload.mood_rating,
        "energy_rating": payload.energy_rating,
        "recorded_at": existing.get("recorded_at", now) if existing else now,
    }


@router.get("/{session_id}/summary", response_model=list[ActivitySummaryRead])
def get_session_summaries(
    session_id: UUID, current_user: CurrentUser, repo: Repository = Depends(get_repository)
):
    session = get_session(repo, current_user, session_id)
    sid = str(session.subject_id)
    assignments = repo.list(path("subjects", sid, "sessions", str(session_id), "activities"))
    ids = {a.id for a in assignments}
    summaries = repo.list(path("subjects", sid, "activitySummaries"), order_by=("created_at", "asc"))
    summaries = [s for s in summaries if s.get("session_activity_id") in ids]
    audit_access(
        repo,
        current_user,
        "session_summaries_read",
        "activity_summary_collection",
        resource_id=str(session_id),
        subject_id=sid,
        details={"result_count": len(summaries)},
    )
    return [
        {
            "id": UUID(s.id),
            "session_activity_id": UUID(s.session_activity_id),
            "subject_id": UUID(s.subject_id),
            "activity_code": s.activity_code,
            "metrics": s.metrics,
            "data_provenance": s.data_provenance,
            "calculation_version": s.calculation_version,
            "created_at": s.created_at,
        }
        for s in summaries
    ]
