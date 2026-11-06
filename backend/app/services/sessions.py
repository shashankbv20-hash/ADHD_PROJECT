from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from app.core.errors import ApiError
from app.repositories.firestore import Repository, Transaction, path
from app.schemas import SessionCreate
from app.services.authorization import get_subject_for_user, require_active_consent, require_participant_owner
from app.services.catalog import CATALOG
from app.services.cpt_scoring import (
    CPT_CALCULATION_VERSION,
    CPT_DATA_PROVENANCE,
    CPT_PRACTICE_STIMULI,
    CPT_RESPONSE_WINDOW_MS,
    CPT_SCORED_STIMULI,
    calculate_cpt_metrics,
    expected_stimuli,
    validate_cpt_event,
)


def _now() -> datetime:
    return datetime.now(UTC)


def _fingerprint(request: SessionCreate) -> str:
    raw = json.dumps(
        request.model_dump(mode="json", exclude={"idempotency_key"}), sort_keys=True, separators=(",", ":")
    )
    return hashlib.sha256(raw.encode()).hexdigest()


def _session_path(sid: str, session_id: str) -> str:
    return path("subjects", sid, "sessions", session_id)


def _assignments(repo: Repository | Transaction, sid: str, session_id: str):
    return sorted(
        repo.list(path("subjects", sid, "sessions", session_id, "activities")),
        key=lambda x: x.get("position", 0),
    )


def _payload(repo: Repository | Transaction, sid: str, session):
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
            for a in _assignments(repo, sid, session.id)
        ],
    }


def _audit(tx: Transaction, user, sid: str, action: str, resource_type: str, resource_id: str, details=None):
    tx.set(
        path("auditEvents", str(uuid4())),
        {
            "actor_user_id": str(user.id),
            "subject_id": sid,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details or {},
            "created_at": _now(),
        },
    )


def _require_consent_tx(tx: Transaction, sid: str, scope: str = "research") -> None:
    scope_state = tx.get(path("subjects", sid, "consentScopes", scope))
    if scope_state is not None:
        consent_id = scope_state.get("current_consent_id")
        current = tx.get(path("subjects", sid, "consents", consent_id)) if consent_id else None
        if (
            scope_state.get("status") == "granted"
            and current
            and current.get("status") == "granted"
            and current.get("granted_at") is not None
            and current.get("withdrawn_at") is None
        ):
            return
        raise ApiError(
            403, "consent_required", f"An active '{scope}' consent is required for this operation."
        )
    consents = tx.list(path("subjects", sid, "consents"), filters=(("scope", "==", scope),))
    current = max(consents, key=lambda item: (item.get("created_at"), item.id), default=None)
    if not current or current.get("status") != "granted" or current.get("withdrawn_at") is not None:
        raise ApiError(
            403, "consent_required", f"An active '{scope}' consent is required for this operation."
        )


def get_session(repo: Repository, user, session_id: UUID, *, write: bool = False):
    # Session IDs are UUIDs, and are located only within the authorized subject subtree.
    if user.role == "participant":
        subjects = repo.list(
            "subjects",
            filters=(("owner_user_id", "==", str(user.id)), ("is_active", "==", True)),
        )
    elif not write and user.role == "caregiver":
        indexes = repo.list(
            path("caregiverSubjectIndex", user.id, "subjects"),
            filters=(("status", "==", "active"),),
        )
        subjects = [
            subject
            for index in indexes
            if (subject := repo.get(path("subjects", index.get("subject_id", index.id)))) is not None
        ]
    else:
        subjects = []
    for subject in subjects:
        sid = subject.id
        try:
            get_subject_for_user(repo, user, UUID(sid), write=write)
        except ApiError:
            continue
        session = repo.get(_session_path(sid, str(session_id)))
        if session:
            if write:
                require_participant_owner(user, subject)
            return session
    raise ApiError(404, "session_not_found", "The requested session was not found.")


def _context(repo, user, session_id, write=True):
    session = get_session(repo, user, session_id, write=write)
    sid = str(session.subject_id)
    return sid, session, _session_path(sid, str(session_id))


def create_session(repo: Repository, user, request: SessionCreate) -> dict[str, Any]:
    subject = get_subject_for_user(repo, user, request.subject_id, write=True)
    require_participant_owner(user, subject)
    sid, fingerprint = str(subject.id), _fingerprint(request)
    require_active_consent(repo, sid, "research")
    # The UID-scoped idempotency record is stored at a stable path and transactionally claimed.
    key_id = hashlib.sha256(f"{user.id}:{request.idempotency_key}".encode()).hexdigest()
    idem_path = path("sessionIdempotency", key_id)
    existing = repo.get(idem_path)
    if existing:
        if existing.request_fingerprint != fingerprint:
            raise ApiError(
                409, "idempotency_conflict", "This idempotency key was used for a different session request."
            )
        if existing.subject_id != sid:
            raise ApiError(409, "idempotency_conflict", "This retry key belongs to a different subject.")
        session = repo.get(_session_path(sid, existing.session_id))
        if session is None:
            raise ApiError(503, "session_idempotency_corrupt", "The session retry record is unavailable.")
        return _payload(repo, sid, session)

    catalog = {item["activity_code"]: item for item in CATALOG}
    codes = {item.activity_code for item in request.activities}
    if any(code not in catalog for code in codes):
        raise ApiError(422, "unknown_activity", "One or more requested activities are unknown.")
    for code in codes:
        if catalog[code]["availability"] != "available":
            raise ApiError(
                409, "activity_unavailable", f"Activity '{code}' is planned and cannot be started."
            )
        if code != "cpt":
            raise ApiError(
                409,
                "activity_not_implemented",
                f"Activity '{code}' has no supported backend event contract yet.",
            )
    configs = repo.list(
        "activities/cpt/configurations",
        filters=(("is_current", "==", True),),
        order_by=("created_at", "desc"),
        limit=1,
    )
    config = configs[0] if configs else None
    if config is None:
        # Catalog constants provide the validated baseline when a configuration document has not been seeded.
        snapshot = {
            "practice_stimuli": list(CPT_PRACTICE_STIMULI),
            "scored_stimuli": list(CPT_SCORED_STIMULI),
            "target_stimulus": "X",
            "response_window_ms": CPT_RESPONSE_WINDOW_MS,
            "trial_index_base": 0,
            "configuration_version": "frontend-cpt-config-v1",
        }
    else:
        snapshot = dict(config.get("configuration", {}))
        if (
            snapshot.get("practice_stimuli") != list(expected_stimuli("practice"))
            or snapshot.get("scored_stimuli") != list(expected_stimuli("scored"))
            or snapshot.get("target_stimulus") != "X"
            or snapshot.get("response_window_ms") != 1200
            or snapshot.get("trial_index_base") != 0
        ):
            raise ApiError(
                409,
                "activity_configuration_unsupported",
                "The active CPT configuration does not match the backend's validated scoring contract.",
            )
        snapshot["configuration_version"] = config.get("version", config.id)
    now, session_id = _now(), str(uuid4())
    sess_path = _session_path(sid, session_id)
    session = {
        "subject_id": sid,
        "owner_uid": str(user.firebase_uid),
        "status": "created",
        "created_at": now,
        "updated_at": now,
        "started_at": None,
        "completed_at": None,
        "idempotency_key": request.idempotency_key,
        "request_fingerprint": fingerprint,
    }
    writes = [(sess_path, session)]
    for pos, item in enumerate(request.activities, 1):
        aid = str(uuid4())
        snap = {
            **snapshot,
            "stimuli": list(expected_stimuli(item.mode)),
            "configuration_source": "frontend-cpt-config-v1",
        }
        writes.append(
            (
                path("subjects", sid, "sessions", session_id, "activities", aid),
                {
                    "session_id": session_id,
                    "activity_code": item.activity_code,
                    "position": pos,
                    "status": "assigned",
                    "mode": item.mode,
                    "configuration_snapshot": snap,
                    "created_at": now,
                    "updated_at": now,
                    "started_at": None,
                    "completed_at": None,
                },
            )
        )

    def commit(tx):
        _require_consent_tx(tx, sid)
        found = tx.get(idem_path)
        if found:
            if found.request_fingerprint != fingerprint:
                raise ApiError(
                    409,
                    "idempotency_conflict",
                    "This idempotency key was used for a different session request.",
                )
            if found.subject_id != sid:
                raise ApiError(409, "idempotency_conflict", "This retry key belongs to a different subject.")
            return found.session_id
        tx.set(sess_path, session)
        for p, data in writes[1:]:
            tx.set(p, data)
        tx.set(
            idem_path,
            {
                "session_id": session_id,
                "subject_id": sid,
                "request_fingerprint": fingerprint,
                "created_at": now,
            },
        )
        _audit(
            tx,
            user,
            sid,
            "session_created",
            "session",
            session_id,
            {"activity_count": len(request.activities)},
        )
        return session_id

    winner = repo.run_transaction(commit)
    return _payload(repo, sid, repo.get(_session_path(sid, winner)))


def _transition(repo, user, session_id, action):
    sid, _, sp = _context(repo, user, session_id)
    if action in {"start", "resume"}:
        require_active_consent(repo, sid, "research")
    now = _now()

    def txfn(tx):
        s = tx.get(sp)
        if action in {"start", "resume"}:
            _require_consent_tx(tx, sid)
        target = {
            "start": ("created", "active"),
            "pause": ("active", "paused"),
            "resume": ("paused", "active"),
            "cancel": (None, "cancelled"),
        }[action]
        old, new = target
        if s.status == new and action in {"pause", "cancel", "start", "resume"}:
            return s
        if action == "cancel" and s.status in {"completed", "cancelled"}:
            if s.status == "cancelled":
                return s
            raise ApiError(409, "invalid_session_transition", "A completed session cannot be cancelled.")
        if old is not None and s.status != old:
            raise ApiError(
                409, "invalid_session_transition", f"Cannot {action} a session in '{s.status}' state."
            )
        patch = {"status": new, "updated_at": now}
        if action == "start":
            patch["started_at"] = now
        if action == "cancel":
            for a in _assignments(tx, sid, str(session_id)):
                if a.status not in {"completed", "skipped"}:
                    tx.update(
                        path("subjects", sid, "sessions", str(session_id), "activities", a.id),
                        {"status": "skipped", "completed_at": now, "updated_at": now},
                    )
        if action in {"pause", "resume"}:
            for a in _assignments(tx, sid, str(session_id)):
                if a.status == ("active" if action == "pause" else "paused"):
                    tx.update(
                        path("subjects", sid, "sessions", str(session_id), "activities", a.id),
                        {"status": "paused" if action == "pause" else "active", "updated_at": now},
                    )
        tx.update(sp, patch)
        audit_action = {
            "start": "session_started",
            "pause": "session_paused",
            "resume": "session_resumed",
            "cancel": "session_cancelled",
        }[action]
        _audit(tx, user, sid, audit_action, "session", str(session_id))

    repo.run_transaction(txfn)
    return _payload(repo, sid, repo.get(sp))


def start_session(repo, user, session_id):
    return _transition(repo, user, session_id, "start")


def pause_session(repo, user, session_id):
    return _transition(repo, user, session_id, "pause")


def resume_session(repo, user, session_id):
    return _transition(repo, user, session_id, "resume")


def cancel_session(repo, user, session_id):
    return _transition(repo, user, session_id, "cancel")


def _assignment(repo, sid, session_id, assignment_id):
    p = path("subjects", sid, "sessions", str(session_id), "activities", str(assignment_id))
    a = repo.get(p)
    if a is None:
        raise ApiError(404, "activity_assignment_not_found", "The activity assignment was not found.")
    return p, a


def start_activity(repo, user, session_id, assignment_id):
    sid, s, sp = _context(repo, user, session_id)
    require_active_consent(repo, sid, "research")
    if s.status != "active":
        raise ApiError(409, "session_not_active", "Start or resume the session before starting an activity.")
    ap, _ = _assignment(repo, sid, session_id, assignment_id)
    now = _now()

    def f(tx):
        _require_consent_tx(tx, sid)
        current_session = tx.get(sp)
        if current_session is None or current_session.status != "active":
            raise ApiError(
                409, "session_not_active", "Start or resume the session before starting an activity."
            )
        aa = tx.get(ap)
        if aa.status == "active":
            return
        if aa.status != "assigned":
            raise ApiError(
                409, "invalid_activity_transition", f"Cannot start an activity in '{aa.status}' state."
            )
        if any(x.status == "active" and x.id != aa.id for x in _assignments(tx, sid, str(session_id))):
            raise ApiError(
                409,
                "another_activity_active",
                "Complete or pause the active activity before starting another.",
            )
        tx.update(ap, {"status": "active", "started_at": now, "updated_at": now})
        _audit(
            tx,
            user,
            sid,
            "activity_started",
            "session_activity",
            str(assignment_id),
            {"activity_code": aa.activity_code},
        )

    repo.run_transaction(f)
    return _payload(repo, sid, repo.get(sp))


def add_cpt_events(repo, user, session_id, assignment_id, request_events):
    sid, s, _ = _context(repo, user, session_id)
    require_active_consent(repo, sid, "research")
    if s.status != "active":
        raise ApiError(409, "session_not_active", "The session must be active to accept activity events.")
    _, a = _assignment(repo, sid, session_id, assignment_id)
    if a.activity_code != "cpt":
        raise ApiError(
            409, "activity_not_implemented", "Event ingestion is currently implemented only for CPT."
        )
    if a.status != "active":
        raise ApiError(409, "activity_not_active", "Start the activity before sending events.")
    indices = [e.trial_index for e in request_events]
    if indices != sorted(indices) or len(indices) != len(set(indices)):
        raise ApiError(
            422, "event_order_invalid", "Events in a batch must have unique ascending trial indices."
        )
    normalized = [validate_cpt_event(e, a.mode) for e in request_events]

    def f(tx):
        _require_consent_tx(tx, sid)
        current_session = tx.get(_session_path(sid, str(session_id)))
        if current_session is None or current_session.status != "active":
            raise ApiError(409, "session_not_active", "The session must be active to accept activity events.")
        current_assignment = tx.get(
            path("subjects", sid, "sessions", str(session_id), "activities", str(assignment_id))
        )
        if (
            current_assignment is None
            or current_assignment.status != "active"
            or current_assignment.activity_code != "cpt"
        ):
            raise ApiError(409, "activity_not_active", "Start the CPT activity before sending events.")
        accepted = duplicates = 0
        base = path("subjects", sid, "sessions", str(session_id), "activities", str(assignment_id), "events")
        existing_by_index = {
            event.trial_index: tx.get(path(base, f"{event.trial_index:03d}")) for event in request_events
        }
        for e, n in zip(request_events, normalized, strict=True):
            ep = path(base, f"{e.trial_index:03d}")
            old = existing_by_index[e.trial_index]
            comp = {k: v for k, v in n.items() if k != "occurred_at"}
            if old:
                if {k: old.get(k) for k in comp} != comp:
                    raise ApiError(
                        409,
                        "event_idempotency_conflict",
                        "A different event already exists at this trial index.",
                    )
                duplicates += 1
                continue
            tx.set(ep, {**comp, "event_type": "cpt_trial_response", "occurred_at": n["occurred_at"]})
            accepted += 1
        _audit(
            tx,
            user,
            sid,
            "activity_events_ingested",
            "session_activity",
            str(assignment_id),
            {"accepted_count": accepted, "duplicate_count": duplicates},
        )
        return accepted, duplicates

    accepted, duplicates = repo.run_transaction(f)
    total = len(
        repo.list(
            path("subjects", sid, "sessions", str(session_id), "activities", str(assignment_id), "events")
        )
    )
    return {"accepted_count": accepted, "duplicate_count": duplicates, "total_event_count": total}


def _finish_activity(repo, user, session_id, assignment_id, skip=False):
    sid, s, sp = _context(repo, user, session_id)
    require_active_consent(repo, sid, "research")
    if s.status != "active":
        raise ApiError(409, "session_not_active", "The session must be active to complete an activity.")
    ap, a = _assignment(repo, sid, session_id, assignment_id)
    now = _now()

    def f(tx):
        _require_consent_tx(tx, sid)
        current_session = tx.get(sp)
        aa = tx.get(ap)
        if current_session is None or aa is None:
            raise ApiError(404, "activity_assignment_not_found", "The activity assignment was not found.")
        if current_session.status != "active":
            if not skip and current_session.status == "completed" and aa.status == "completed":
                return
            raise ApiError(409, "session_not_active", "The session must be active to complete an activity.")
        events_path = path(ap, "events")
        events = sorted(tx.list(events_path), key=lambda e: e.get("trial_index", -1))
        assignments = _assignments(tx, sid, str(session_id))
        finished = all(
            item.id == str(assignment_id) or item.status in {"completed", "skipped"} for item in assignments
        )
        if skip:
            if aa.status not in {"assigned", "active", "paused"}:
                raise ApiError(
                    409, "invalid_activity_transition", f"Cannot skip an activity in '{aa.status}' state."
                )
            newstatus = "skipped"
        else:
            if aa.status == "completed":
                return
            if aa.status != "active":
                raise ApiError(409, "activity_not_active", "Start the activity before completing it.")
            if aa.activity_code != "cpt":
                raise ApiError(
                    409, "activity_not_implemented", "This activity has no completion/scoring contract yet."
                )
            if [e.trial_index for e in events] != list(range(len(expected_stimuli(aa.mode)))):
                raise ApiError(
                    409,
                    "activity_events_incomplete",
                    "The CPT must contain every configured trial before completion.",
                )
            if aa.mode == "scored":
                metrics = calculate_cpt_metrics([dict(e) for e in events])
                summary_id = str(assignment_id)
                tx.set(
                    path("subjects", sid, "activitySummaries", summary_id),
                    {
                        "session_activity_id": str(assignment_id),
                        "session_id": str(session_id),
                        "subject_id": sid,
                        "activity_code": "cpt",
                        "metrics": metrics,
                        "data_provenance": CPT_DATA_PROVENANCE,
                        "calculation_version": CPT_CALCULATION_VERSION,
                        "created_at": now,
                    },
                )
            newstatus = "completed"
        tx.update(ap, {"status": newstatus, "completed_at": now, "updated_at": now})
        if finished:
            tx.update(sp, {"status": "completed", "completed_at": now, "updated_at": now})
            _audit(
                tx,
                user,
                sid,
                "session_completed",
                "session",
                str(session_id),
                {"assignment_count": len(assignments)},
            )
        else:
            _audit(
                tx,
                user,
                sid,
                "activity_skipped" if skip else "activity_completed",
                "session_activity",
                str(assignment_id),
                {"activity_code": aa.activity_code, "mode": aa.mode},
            )

    repo.run_transaction(f)
    latest = repo.get(sp)
    if latest and latest.status == "completed" and not skip and a.mode == "scored":
        from app.services.digital_twin import rebuild_digital_twin

        rebuild_digital_twin(repo, UUID(sid), user.id)
    return _payload(repo, sid, latest)


def complete_activity(repo, user, session_id, assignment_id):
    return _finish_activity(repo, user, session_id, assignment_id)


def skip_activity(repo, user, session_id, assignment_id):
    return _finish_activity(repo, user, session_id, assignment_id, True)
