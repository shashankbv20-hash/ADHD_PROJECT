# FastAPI and Firestore Integration

## Identity and persistence

Protected `/api/v1` routes require `Authorization: Bearer <Firebase ID token>`.
FastAPI verifies the token server-side using Firebase Admin, then uses only the
verified UID and allowlisted role. The Firebase Admin Firestore repository is
the backend persistence adapter; no PostgreSQL/SQLAlchemy/Alembic runtime is
active.

The current Next.js app is not yet connected to the API. It continues to use
Firebase Web Auth and existing participant-scoped Firestore/demo services. The
API preserves `users/{uid}` profile shape and writes server-authoritative domain
records under `subjects/{subjectId}`. It does not write the legacy
`users/{uid}/appSessions`, `activityRuns`, `reports`, or `digitalTwin/current`
paths. Do not enable a frontend API write and its direct Firestore save for the
same operation. No data migration or Firestore rules deployment is performed.

## Implemented API contracts

| Method | Path | Behavior/access |
|---|---|---|
| `GET` | `/health/live` | Process liveness. |
| `GET` | `/health/ready` | Read-only Firestore readiness check; safe 503 when repository is not configured/unavailable. |
| `GET` | `/api/v1/capabilities` | Reports Firestore/Auth configuration and blocked EEG/webcam/AI Buddy. |
| `GET`, `PATCH` | `/api/v1/users/me` | Verified Firebase UID profile. Patch changes display name only; trusted role is never client-editable. |
| `GET`, `POST` | `/api/v1/subjects` | Lists authorized subjects or creates participant-owned subject. |
| `GET`, `PATCH` | `/api/v1/subjects/{subject_id}` | Owner/caregiver-authorized read; owner may change display label. |
| `POST`, `GET`, `DELETE` | `/api/v1/subjects/{subject_id}/caregivers...` | Owner grants/revokes an already trusted caregiver; caregiver may revoke self. |
| `POST`, `GET` | `/api/v1/subjects/{subject_id}/consents` | Owner records versioned/idempotent consent and reads consent history. |
| `POST` | `/api/v1/subjects/{subject_id}/consents/{consent_id}/withdraw` | Owner withdrawal takes effect transactionally. |
| `GET` | `/api/v1/activities`, `/api/v1/activities/{activity_code}` | Versioned catalog; CPT available, other activities planned. |
| `POST`, `GET` | `/api/v1/sessions` | Owner creates idempotent session or reads stable paginated session list by `subjectId`. |
| `GET` | `/api/v1/sessions/{session_id}` | Owner or active caregiver read. |
| `POST` | `/api/v1/sessions/{session_id}/start`, `/pause`, `/resume`, `/cancel`, `/complete` | Validated lifecycle transitions; pause/cancel remain stop controls. |
| `POST` | `/api/v1/sessions/{session_id}/activities/{assignment_id}/start`, `/events:batch`, `/complete`, `/skip` | CPT-only validated event workflow; stable per-trial idempotency. |
| `POST` | `/api/v1/sessions/{session_id}/feeling-checkins` | Participant-owned pre/post 1–5 mood/energy check-in; active research consent required. |
| `GET` | `/api/v1/sessions/{session_id}/summary` | Server-persisted summary list. |
| `GET` | `/api/v1/subjects/{subject_id}/progress` | Subject-authorized aggregate of persisted summary records. |
| `GET` | `/api/v1/subjects/{subject_id}/activity-summaries` | Stable cursor-paginated summary history. |
| `GET` | `/api/v1/subjects/{subject_id}/digital-twin`, `/history` | Current descriptive profile and immutable versions. |
| `GET`, `POST` | `/api/v1/subjects/{subject_id}/reports` | Read reports or idempotently create report from persisted summaries. |
| `POST` | `/api/v1/ai-buddy/messages` | Authenticated explicit 503; no message is sent/stored without approved provider. |

Errors use `{ "error": { "code", "message", "requestId" } }`. Firestore SDK
errors return a safe unavailable response and are not reported as successful
writes. Logs exclude tokens, request bodies, event payloads and sensitive
record contents.

The persistence cutover changes identity fields that were formerly local SQL
UUIDs: `UserRead.id`, `firebaseUid`, `SubjectRead.ownerUserId`,
`CaregiverRelationshipRead.caregiverUserId`, and `ConsentRead.actorUserId` now
represent Firebase UIDs as strings. Subject/session/assignment/consent/report
record IDs remain UUID strings. Confirm these UID-shaped fields in any future
frontend adapter before enabling remote mode.

## CPT and consent contract

- Backend validates the configured 6-trial practice and 24-trial scored CPT
  stimulus sequence. Server-calculated metrics are derived from event docs;
  client totals are not trusted. Practice does not create scored summaries or
  Twin observations.
- Browser timestamps do not define session chronology; validated events receive
  server timestamps. Retries with identical trial content are idempotent;
  conflicting retries return 409.
- Session creation, event collection, check-ins, scoring, longitudinal updates,
  and report generation require active research consent. The current consent
  state is checked inside the Firestore transaction for collection writes;
  a newer grant supersedes old versions and withdrawal cannot fall back.
- Pause and cancel remain available after withdrawal to stop collection.
- Provenance remains `frontend-cpt-demo-event-derived-v1`; metrics are
  descriptive research-task values, not clinical conclusions.

## Authorization

- Backend roles come from verified Firebase custom claims only; `child` maps to
  `participant`, unknown claims fail closed, and public requests cannot grant
  caregiver/clinician/researcher role.
- A participant can access only owned subjects. Caregiver reads require an
  explicit active relationship; caregiver writes are denied. Clinician and
  researcher subject access remains denied pending an approved assignment rule.
- Frontend Firestore Rules remain restrictive for Web SDK access. Admin SDK
  bypasses them, so authorization is enforced in FastAPI. No rules or indexes
  are deployed by these changes.

## Firestore collections and remaining integration

See [ADR-001](adr-001-firestore-first.md) and
[`firestore_indexes.md`](firestore_indexes.md) for paths and index patterns.
Raw EEG/video do not belong in Firestore. The frontend API client still needs a
Firebase token provider, typed API adapter, mode/cutover plan and browser-level
tests. Existing Firestore records are preserved in place; no automatic import,
copy or delete is performed.

EEG model inference, webcam feature extraction and AI Buddy provider remain
unavailable for missing model/preprocessing artifacts, approved extractor/
policy and LLM configuration. Their capability is not simulated.
