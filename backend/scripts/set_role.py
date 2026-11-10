"""Assign or remove a trusted role claim on a Firebase user (administrator tool).

Roles are enforced from verified Firebase custom claims, and the public API can never
assign them. This is the supported trusted process for granting a role such as
``caregiver``, ``clinician`` or ``researcher``. Run it deliberately, from an operator
machine; it is not part of the deployed service.

    # Local emulator (set FIREBASE_AUTH_EMULATOR_HOST first; no credentials needed)
    python scripts/set_role.py --project demo-attune-tests --uid <uid> --role caregiver --yes

    # Real project (uses your Application Default Credentials; double-check the project!)
    python scripts/set_role.py --project <project-id> --email person@example.org --role clinician --yes

Existing custom claims other than ``role`` are preserved. A user's current ID token keeps
its old claims until it refreshes (up to an hour) or the user signs in again; pass
``--revoke`` to force that by revoking their refresh tokens.
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

ALLOWED_ROLES = ("participant", "caregiver", "clinician", "researcher")


def merged_claims(existing: dict[str, Any] | None, role: str) -> dict[str, Any]:
    """Return the custom claims with ``role`` set, or removed for the default participant role."""
    claims = dict(existing or {})
    if role == "participant":
        claims.pop("role", None)
    else:
        claims["role"] = role
    return claims


def apply_role(
    *, project: str, uid: str | None, email: str | None, role: str, revoke: bool
) -> dict[str, Any]:
    """Apply the role and return a small report. Raises on unknown users."""
    import firebase_admin
    from firebase_admin import auth

    if role not in ALLOWED_ROLES:
        raise ValueError(f"role must be one of {', '.join(ALLOWED_ROLES)}")
    if bool(uid) == bool(email):
        raise ValueError("provide exactly one of --uid or --email")

    name = f"attune-set-role-{project}"
    try:
        app = firebase_admin.get_app(name)
    except ValueError:
        app = firebase_admin.initialize_app(options={"projectId": project}, name=name)

    user = auth.get_user(uid, app=app) if uid else auth.get_user_by_email(email, app=app)
    previous = (user.custom_claims or {}).get("role")
    auth.set_custom_user_claims(user.uid, merged_claims(user.custom_claims, role), app=app)
    if revoke:
        auth.revoke_refresh_tokens(user.uid, app=app)

    return {"uid": user.uid, "previous_role": previous, "role": role, "revoked": revoke}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Assign a trusted Firebase role claim.")
    parser.add_argument("--project", required=True, help="Firebase project ID")
    parser.add_argument("--uid", help="Firebase UID of the user")
    parser.add_argument("--email", help="Email of the user (alternative to --uid)")
    parser.add_argument("--role", required=True, choices=ALLOWED_ROLES)
    parser.add_argument("--revoke", action="store_true", help="also revoke the user's refresh tokens")
    parser.add_argument("--yes", action="store_true", help="confirm the change (required)")
    args = parser.parse_args(argv)

    emulator = os.environ.get("FIREBASE_AUTH_EMULATOR_HOST")
    target = f"Auth emulator at {emulator}" if emulator else f"REAL Firebase project '{args.project}'"
    who = args.uid or args.email
    print(f"About to set role '{args.role}' for {who} on {target}.")
    if not args.yes:
        print("Refusing to continue without --yes.", file=sys.stderr)
        return 2

    try:
        report = apply_role(
            project=args.project, uid=args.uid, email=args.email, role=args.role, revoke=args.revoke
        )
    except Exception as exc:
        print(f"Failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1

    print(
        f"Done: {report['uid']} role {report['previous_role'] or 'participant'} -> {report['role']}"
        + (" (refresh tokens revoked)" if report["revoked"] else "")
    )
    if not report["revoked"]:
        print("The user's current token keeps its old role until it refreshes or they sign in again.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
