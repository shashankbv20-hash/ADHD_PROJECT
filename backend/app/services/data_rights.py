"""Participant data rights: export, erasure and a readable access log.

All three are owner-only (enforced by the routes). Design decisions, recorded here
because they are policy-relevant:

* **Export** returns the subject's stored records as they are held (including trial
  events), so the participant can see exactly what the system keeps.
* **Erasure** deletes research *data* (sessions, trial events, check-ins, summaries,
  Digital Twin and its history, reports, retry records) and withdraws active
  consent first so nothing new is collected meanwhile. It deliberately keeps the
  subject record, the consent history (a record that consent was given/withdrawn)
  and the audit log (minimal metadata, no content). It is not account deletion.
* Erasure is idempotent and safe to repeat after a partial failure.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.repositories.firestore import Document, Repository, path
from app.services.authorization import audit_access
from app.services.consent import withdraw_consent_record

# Subcollections of subjects/{id} that hold research data and are removed by erasure.
ERASED_SUBJECT_COLLECTIONS = (
    "sessions",  # includes nested activities, trial events and feeling check-ins
    "activitySummaries",
    "digitalTwin",
    "digitalTwinHistory",
    "reports",
    "reportIdempotency",
)

EXPORT_NOTES = [
    "Contains the records this system stores for this subject, including trial-by-trial CPT events.",
    "Practice runs, EEG files and webcam video are never collected by this system.",
    "The access log lists actions recorded about this subject; it does not include other people's identifiers.",
    "Values are descriptive research measurements, not a diagnosis or clinical assessment.",
]

# Keys that are internal bookkeeping rather than the participant's data.
_INTERNAL_KEYS = {"request_fingerprint"}


def _record(document: Document) -> dict[str, Any]:
    return {key: value for key, value in document.items() if key not in _INTERNAL_KEYS}


def _scalar_details(details: Any) -> dict[str, Any]:
    """Keep only simple values from audit details so nothing structured/sensitive leaks."""
    if not isinstance(details, dict):
        return {}
    return {
        key: value
        for key, value in details.items()
        if isinstance(value, str | int | float | bool) or value is None
    }


def list_subject_audit_events(repository: Repository, subject_id: str, user_id: str, limit: int = 200):
    events = repository.list(
        "auditEvents",
        filters=(("subject_id", "==", str(subject_id)),),
        order_by=("created_at", "desc"),
        limit=limit,
    )
    return [
        {
            "id": event.id,
            "action": event.get("action", ""),
            "resource_type": event.get("resource_type", ""),
            "created_at": event.get("created_at"),
            "actor_is_you": event.get("actor_user_id") == str(user_id),
            "details": _scalar_details(event.get("details")),
        }
        for event in events
    ]


def export_subject_data(repository: Repository, subject: Document, user) -> dict[str, Any]:
    sid = str(subject.id)

    sessions = []
    for session in repository.list(path("subjects", sid, "sessions"), order_by=("created_at", "asc")):
        activities = []
        for activity in repository.list(
            path("subjects", sid, "sessions", session.id, "activities"), order_by=("position", "asc")
        ):
            events = repository.list(
                path("subjects", sid, "sessions", session.id, "activities", activity.id, "events"),
                order_by=("trial_index", "asc"),
            )
            activities.append({**_record(activity), "events": [_record(event) for event in events]})
        check_ins = repository.list(path("subjects", sid, "sessions", session.id, "feelingCheckIns"))
        sessions.append(
            {
                **_record(session),
                "activities": activities,
                "feelingCheckIns": [_record(item) for item in check_ins],
            }
        )

    twin_current = repository.get(path("subjects", sid, "digitalTwin", "current"))
    bundle = {
        "exportedAt": datetime.now(UTC),
        "subject": {
            key: subject.get(key)
            for key in ("id", "display_label", "created_at", "is_active", "data_erased_at")
        },
        "consents": [
            _record(item)
            for item in repository.list(path("subjects", sid, "consents"), order_by=("created_at", "asc"))
        ],
        "caregiverRelationships": [
            _record(item) for item in repository.list(path("subjects", sid, "caregiverRelationships"))
        ],
        "sessions": sessions,
        "activitySummaries": [
            _record(item)
            for item in repository.list(
                path("subjects", sid, "activitySummaries"), order_by=("created_at", "asc")
            )
        ],
        "digitalTwin": {
            "current": _record(twin_current) if twin_current else None,
            "history": [
                _record(item)
                for item in repository.list(
                    path("subjects", sid, "digitalTwinHistory"), order_by=("version", "asc")
                )
            ],
        },
        "reports": [
            _record(item)
            for item in repository.list(path("subjects", sid, "reports"), order_by=("created_at", "asc"))
        ],
        "accessLog": list_subject_audit_events(repository, sid, str(user.id), limit=1000),
        "notes": EXPORT_NOTES,
    }

    audit_access(
        repository,
        user,
        "subject_data_exported",
        "subject_export",
        resource_id=sid,
        subject_id=sid,
        details={
            "session_count": len(sessions),
            "summary_count": len(bundle["activitySummaries"]),
            "report_count": len(bundle["reports"]),
        },
    )
    return bundle


def erase_subject_data(repository: Repository, subject: Document, user) -> dict[str, Any]:
    sid = str(subject.id)

    # 1. Stop collection first: withdraw every active consent (transactional, audited).
    withdrawn = 0
    for consent in repository.list(path("subjects", sid, "consents"), filters=(("status", "==", "granted"),)):
        withdraw_consent_record(repository, user, sid, consent.id)
        withdrawn += 1

    # 2. Delete research data, including nested subcollections.
    deleted = {
        name: repository.delete_collection(path("subjects", sid, name)) for name in ERASED_SUBJECT_COLLECTIONS
    }

    # 3. Session retry records live in a top-level collection keyed by a hash.
    retry_records = repository.list("sessionIdempotency", filters=(("subject_id", "==", sid),))
    for record in retry_records:
        repository.delete(path("sessionIdempotency", record.id))
    deleted["sessionIdempotency"] = len(retry_records)

    # 4. Record that erasure happened (the subject, consent history and audit log are kept).
    now = datetime.now(UTC)
    repository.update(path("subjects", sid), {"data_erased_at": now})
    repository.set(
        path("auditEvents", str(uuid4())),
        {
            "actor_user_id": str(user.id),
            "subject_id": sid,
            "action": "subject_data_erased",
            "resource_type": "subject_data",
            "resource_id": sid,
            "details": {
                "withdrawn_consents": withdrawn,
                **{f"deleted_{key}": value for key, value in deleted.items()},
            },
            "created_at": now,
        },
    )

    return {
        "subject_id": sid,
        "erased_at": now,
        "withdrawn_consent_count": withdrawn,
        "deleted_document_counts": deleted,
    }
