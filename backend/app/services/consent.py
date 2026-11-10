from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.core.errors import ApiError
from app.repositories.firestore import Repository, path


def withdraw_consent_record(repository: Repository, user: Any, subject_id: Any, consent_id: Any) -> Any:
    """Withdraw one consent record transactionally and audit it.

    Idempotent: withdrawing an already-withdrawn or superseded record changes nothing.
    The caller is responsible for authorizing the actor against the subject.
    """
    cp = path("subjects", subject_id, "consents", consent_id)
    now = datetime.now(UTC)

    def withdraw(tx):
        consent = tx.get(cp)
        if consent is None:
            raise ApiError(404, "consent_not_found", "The consent record was not found.")
        scope_path = path("subjects", subject_id, "consentScopes", consent.get("scope"))
        scope_state = tx.get(scope_path)
        if consent.get("status") == "granted":
            tx.update(cp, {"status": "withdrawn", "withdrawn_at": now})
            consent.update({"status": "withdrawn", "withdrawn_at": now})
            if scope_state is None or scope_state.get("current_consent_id") == str(consent_id):
                tx.set(
                    scope_path,
                    {
                        "scope": consent.get("scope"),
                        "current_consent_id": str(consent_id),
                        "status": "withdrawn",
                        "updated_at": now,
                    },
                )
            tx.set(
                path("auditEvents", str(uuid4())),
                {
                    "actor_user_id": str(user.id),
                    "subject_id": str(subject_id),
                    "action": "consent_withdrawn",
                    "resource_type": "consent_record",
                    "resource_id": str(consent_id),
                    "details": {"scope": consent.get("scope"), "version": consent.get("version")},
                    "created_at": now,
                },
            )
        return consent

    return repository.run_transaction(withdraw)
