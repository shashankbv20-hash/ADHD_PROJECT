from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import CurrentUser
from app.core.errors import ApiError
from app.repositories.dependencies import get_repository
from app.repositories.firestore import Repository, path
from app.schemas import (
    ActivitySummaryList,
    DigitalTwinHistoryList,
    DigitalTwinRead,
    ProgressRead,
    ReportCreate,
    ReportList,
    ReportRead,
)
from app.services.authorization import (
    audit_access,
    get_subject_for_user,
    require_active_consent,
    require_participant_owner,
)
from app.services.cpt_scoring import aggregate_cpt_summaries
from app.services.digital_twin import read_twin_snapshot
from app.services.pagination import decode_created_cursor, encode_created_cursor

router = APIRouter(prefix="/subjects", tags=["analytics", "digital-twin", "reports"])


def _ordered(records, descending=False):
    return sorted(records, key=lambda item: (item.created_at, item.id), reverse=descending)


def _report_read(report):
    return {
        key: report.get(key)
        for key in (
            "id",
            "subject_id",
            "session_id",
            "report_type",
            "template_version",
            "content",
            "created_at",
        )
    }


def _summary_read(summary):
    return {
        key: summary.get(key)
        for key in (
            "id",
            "session_activity_id",
            "subject_id",
            "activity_code",
            "metrics",
            "data_provenance",
            "calculation_version",
            "created_at",
        )
    }


@router.get("/{subject_id}/progress", response_model=ProgressRead)
def subject_progress(
    subject_id: UUID, current_user: CurrentUser, repository: Repository = Depends(get_repository)
) -> dict:
    subject = get_subject_for_user(repository, current_user, subject_id)
    summaries = _ordered(repository.list(path("subjects", subject.id, "activitySummaries")))
    aggregate = aggregate_cpt_summaries([item.metrics for item in summaries])
    audit_access(
        repository,
        current_user,
        "subject_progress_read",
        "subject_progress",
        subject_id=subject.id,
        details={"summary_count": len(summaries)},
    )
    return {
        "subject_id": subject.id,
        "summary_count": len(summaries),
        "aggregate_metrics": aggregate,
        "observation_start": summaries[0].created_at if summaries else None,
        "observation_end": summaries[-1].created_at if summaries else None,
        "data_provenance": "frontend-cpt-demo-derived-v1",
    }


@router.get("/{subject_id}/activity-summaries", response_model=ActivitySummaryList)
def subject_activity_summaries(
    subject_id: UUID,
    current_user: CurrentUser,
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = None,
    repository: Repository = Depends(get_repository),
) -> dict:
    subject = get_subject_for_user(repository, current_user, subject_id)
    cursor_data = decode_created_cursor(cursor) if cursor else None
    summaries = repository.page(
        path("subjects", subject.id, "activitySummaries"),
        order_by="created_at",
        descending=True,
        after=(cursor_data[0], str(cursor_data[1])) if cursor_data else None,
        limit=limit + 1,
    )
    items, has_more = summaries[:limit], len(summaries) > limit
    next_cursor = (
        encode_created_cursor(items[-1].created_at, UUID(items[-1].id)) if has_more and items else None
    )
    audit_access(
        repository,
        current_user,
        "activity_summaries_read",
        "activity_summary_collection",
        subject_id=subject.id,
        details={"result_count": len(items)},
    )
    return {"items": [_summary_read(item) for item in items], "next_cursor": next_cursor}


@router.get("/{subject_id}/digital-twin", response_model=DigitalTwinRead)
def subject_digital_twin(
    subject_id: UUID, current_user: CurrentUser, repository: Repository = Depends(get_repository)
) -> dict:
    subject = get_subject_for_user(repository, current_user, subject_id)
    version, profile, quality_flags, updated_at = read_twin_snapshot(repository, subject.id)
    audit_access(
        repository,
        current_user,
        "digital_twin_read",
        "digital_twin_profile",
        resource_id=str(subject.id),
        subject_id=subject.id,
        details={"version": version},
    )
    return {
        "subject_id": subject.id,
        "version": version,
        "status": profile.get("status", "insufficient_data"),
        "profile": profile,
        "quality_flags": quality_flags,
        "updated_at": updated_at,
    }


@router.get("/{subject_id}/digital-twin/history", response_model=DigitalTwinHistoryList)
def subject_digital_twin_history(
    subject_id: UUID, current_user: CurrentUser, repository: Repository = Depends(get_repository)
) -> dict:
    subject = get_subject_for_user(repository, current_user, subject_id)
    history = repository.list(
        path("subjects", subject.id, "digitalTwinHistory"), order_by=("version", "desc"), limit=100
    )
    audit_access(
        repository,
        current_user,
        "digital_twin_history_read",
        "digital_twin_history",
        subject_id=subject.id,
        details={"result_count": len(history)},
    )
    return {"items": history}


@router.get("/{subject_id}/reports", response_model=ReportList)
def subject_reports(
    subject_id: UUID, current_user: CurrentUser, repository: Repository = Depends(get_repository)
) -> dict:
    subject = get_subject_for_user(repository, current_user, subject_id)
    reports = repository.list(
        path("subjects", subject.id, "reports"), order_by=("created_at", "desc"), limit=100
    )
    audit_access(
        repository,
        current_user,
        "reports_read",
        "report_collection",
        subject_id=subject.id,
        details={"result_count": len(reports)},
    )
    return {"items": [_report_read(report) for report in reports]}


@router.post("/{subject_id}/reports", response_model=ReportRead, status_code=201)
def create_subject_report(
    subject_id: UUID,
    payload: ReportCreate,
    current_user: CurrentUser,
    repository: Repository = Depends(get_repository),
) -> dict:
    subject = get_subject_for_user(repository, current_user, subject_id, write=True)
    require_participant_owner(current_user, subject)
    sid = str(subject.id)
    fingerprint_data = {
        "subject_id": sid,
        "session_id": str(payload.session_id) if payload.session_id else None,
    }
    fingerprint = hashlib.sha256(json.dumps(fingerprint_data, sort_keys=True).encode()).hexdigest()
    reports_path = path("subjects", sid, "reports")
    idempotency_id = hashlib.sha256(payload.idempotency_key.encode()).hexdigest()
    idempotency_path = path("subjects", sid, "reportIdempotency", idempotency_id)
    marker = repository.get(idempotency_path)
    existing = (
        repository.get(path(reports_path, marker.get("report_id")))
        if marker and marker.get("report_id")
        else None
    )
    if existing:
        if existing.request_fingerprint != fingerprint:
            raise ApiError(
                409,
                "report_idempotency_conflict",
                "This report idempotency key was used for a different request.",
            )
        return _report_read(existing)

    require_active_consent(repository, subject.id, "research")
    if payload.session_id is not None:
        source_session = repository.get(path("subjects", sid, "sessions", payload.session_id))
        if source_session is None or source_session.status != "completed":
            raise ApiError(404, "session_not_found", "The completed subject session was not found.")
        assignments = repository.list(
            path("subjects", sid, "sessions", str(payload.session_id), "activities")
        )
        assignment_ids = {item.id for item in assignments}
        summaries = [
            item
            for item in repository.list(path("subjects", sid, "activitySummaries"))
            if str(item.get("session_activity_id")) in assignment_ids
        ]
    else:
        summaries = repository.list(path("subjects", sid, "activitySummaries"))
    summaries = _ordered(summaries)
    if not summaries:
        raise ApiError(
            409, "report_insufficient_data", "No persisted activity summaries are available for this report."
        )
    content = {
        "subject_id": sid,
        "session_id": str(payload.session_id) if payload.session_id else None,
        "summary_count": len(summaries),
        "metrics": aggregate_cpt_summaries([item.metrics for item in summaries]),
        "source_summary_ids": [item.id for item in summaries],
        "data_provenance": "frontend-cpt-demo-derived-v1",
        "limitations": [
            "Descriptive CPT task metrics only; not a diagnosis or clinical assessment.",
            "No EEG recordings, model predictions, or webcam-derived features are included.",
        ],
    }
    report_id, now = str(uuid5(NAMESPACE_URL, f"report:{sid}:{idempotency_id}")), datetime.now(UTC)
    report = {
        "id": report_id,
        "subject_id": sid,
        "generated_by_user_id": str(current_user.id),
        "session_id": str(payload.session_id) if payload.session_id else None,
        "idempotency_key": payload.idempotency_key,
        "request_fingerprint": fingerprint,
        "report_type": "cpt-summary",
        "template_version": "cpt-summary-v1",
        "content": content,
        "created_at": now,
    }
    report_path = path("subjects", sid, "reports", report_id)

    def create(tx):
        scope_path = path("subjects", sid, "consentScopes", "research")
        scope_state = tx.get(scope_path)
        if scope_state:
            current_id = scope_state.get("current_consent_id")
            current = tx.get(path("subjects", sid, "consents", current_id)) if current_id else None
            consent_is_active = bool(
                scope_state.get("status") == "granted"
                and current
                and current.get("status") == "granted"
                and current.get("withdrawn_at") is None
            )
        else:
            consents = tx.list(path("subjects", sid, "consents"), filters=(("scope", "==", "research"),))
            latest = max(consents, key=lambda item: (item.get("created_at"), item.id), default=None)
            consent_is_active = bool(
                latest and latest.get("status") == "granted" and latest.get("withdrawn_at") is None
            )
        if not consent_is_active:
            raise ApiError(
                403, "consent_required", "An active 'research' consent is required for this operation."
            )
        previous = tx.get(idempotency_path)
        if previous:
            if previous.get("request_fingerprint") != fingerprint:
                raise ApiError(
                    409,
                    "report_idempotency_conflict",
                    "This report idempotency key was used for a different request.",
                )
            previous_report = tx.get(path(reports_path, previous.get("report_id")))
            if previous_report is None:
                raise ApiError(503, "report_idempotency_corrupt", "The report retry record is unavailable.")
            return previous_report
        tx.set(report_path, report)
        tx.set(
            idempotency_path,
            {"report_id": report_id, "request_fingerprint": fingerprint, "created_at": now},
        )
        tx.set(
            path("auditEvents", str(uuid4())),
            {
                "actor_user_id": str(current_user.id),
                "subject_id": sid,
                "action": "report_generated",
                "resource_type": "report",
                "resource_id": report_id,
                "details": {"report_type": report["report_type"], "summary_count": len(summaries)},
                "created_at": now,
            },
        )
        return report

    persisted = repository.run_transaction(create)
    if persisted.get("request_fingerprint") != fingerprint:
        raise ApiError(
            409,
            "report_idempotency_conflict",
            "This report idempotency key was used for a different request.",
        )
    return _report_read(persisted)
