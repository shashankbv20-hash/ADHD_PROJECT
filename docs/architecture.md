# Shared Architecture

## Decision

Firebase Authentication and Cloud Firestore are the active identity and
persistence platform. This intentionally supersedes the original PostgreSQL
specification retained as history in `backend_plan.md`. See [ADR-001](adr-001-firestore-first.md)
for the rationale, document layout, security rules, and limitations.

```text
Next.js frontend -> Firebase Authentication -> Firebase ID token
                                              -> FastAPI
                                                  -> Firebase Admin SDK
                                                      -> Cloud Firestore
```

The existing Next.js app remains intact. Frontend authentication and current
owner-scoped Firestore features continue to work. For protected API requests,
the frontend will eventually attach `Authorization: Bearer <Firebase ID token>`.
The API adapter/cutover is not implemented yet.

## Responsibilities

- **Firebase Authentication:** identity provider and signed trusted custom role
  claims. Public profile forms cannot grant privileged roles.
- **Frontend (`frontend/`):** existing UI, Firebase Web Auth, current participant
  profile/optional demo CPT cloud sync, and demo providers. Existing records are
  preserved where they are; there is no automatic migration or deletion.
- **FastAPI (`backend/`):** verifies Firebase tokens; enforces role, ownership,
  caregiver relationships and consent; validates session/events; computes CPT
  summaries, progress, reports and versioned Digital Twin records. It is the
  authoritative path for operations performed through its API.
- **Cloud Firestore:** primary application persistence. Admin SDK access bypasses
  Firestore Rules, so the API performs all authorization checks itself.
- **Private object storage:** planned for large EEG recordings; Firestore will
  keep metadata/references only. Provider and policy are not selected.

## Document structure

The API uses the existing exact frontend profile at `users/{uid}`. It keeps
server-managed role projection at `backendUsers/{uid}` and subject-owned domain
records under `subjects/{subjectId}`. Sessions contain nested activity assignment
documents and per-trial event documents. Summaries, consents, caregiver links,
reports, and versioned Twin history are subject subcollections. Catalog/config
documents are under `activities/{code}`. Minimal audit records are in
`auditEvents/{id}`; stable create retries use `sessionIdempotency/{hash}`. The
complete layout and query/index notes are in [ADR-001](adr-001-firestore-first.md)
and [Firestore index notes](firestore_indexes.md).

Backend-owned records are not copied into the legacy frontend paths
`users/{uid}/appSessions`, `activityRuns`, `reports`, or `digitalTwin/current`.
Until API cutover, the frontend's existing direct Firestore/demo operations
remain intact. When the frontend calls the API for a given authoritative
operation, its direct Firestore save for that same operation must be disabled.

## Authorization and frontend Rules

FastAPI verifies the ID token with Firebase Admin and uses UID and role claims
from that verified token only. Participant ownership compares the authenticated
UID with the subject's owner UID. Caregiver reads require an active explicit
relationship; writes remain participant-owner-only. Clinician/researcher
subject assignment is denied until policy exists. Research collection requires
current consent, transactionally checked with writes; withdrawal takes effect
for subsequent intake, while pause/cancel remain stop controls.

The local `frontend/firestore.rules` remains unchanged and restrictive for Web
SDK calls: `users/{uid}` profile access is owner-scoped; role cannot be escalated;
deletion is denied; legacy summary/session/report/Twin writes require the
owner's `cloudSyncEnabled` flag. Admin SDK bypasses these rules. No rule/index
deployment is included in this task.

## Operational and verification status

Backend code uses the Firestore repository; PostgreSQL, SQLAlchemy, Alembic and
their Compose service are archived as inactive. Runtime uses Firebase Admin
Firestore when project configuration/credentials are available; the 18 tests
inject an in-memory repository. These are not emulator or live-cloud checks:
Firestore Emulator Suite tests did not run, and neither live Firebase Auth token
verification nor Firestore reads/writes were verified.

EEG inference is blocked by missing `.pth`/preprocessing artifacts; webcam
processing lacks an approved extractor/input policy; AI Buddy has no configured
approved LLM provider. These capabilities remain explicitly unavailable. Raw
EEG/video are not stored in Firestore.
