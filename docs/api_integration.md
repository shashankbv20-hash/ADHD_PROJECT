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
| `GET` | `/api/v1/caregiver/subjects` | **Caregiver role only.** Subjects whose owner currently shares with the caller: subject ID, display label, `relationshipId` (needed to stop viewing) and share date. Does not include the owner's identifier. |
| `GET` | `/api/v1/subjects/{subject_id}/export` | **Owner only.** Everything stored for the subject (consents, sessions with trial events and check-ins, summaries, Twin current + history, reports, access log). Audited. |
| `GET` | `/api/v1/subjects/{subject_id}/audit-events` | **Owner only.** Recorded actions about the subject, newest first. Reports whether the owner performed each action (`actorIsYou`); other accounts' identifiers are never returned. Needs the `auditEvents` composite index. |
| `POST` | `/api/v1/subjects/{subject_id}/data-erasure` | **Owner only, irreversible, idempotent.** Body `{"confirmation": "ERASE MY DATA"}`. Withdraws active consent first, then deletes sessions (with events/check-ins), summaries, Twin + history, reports and retry records. Keeps the subject, consent history and audit log; sets `data_erased_at`. |
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

## Caregiver sharing

A caregiver is a Firebase account with the trusted custom claim `role: caregiver`,
assigned by the research team with `backend/scripts/set_role.py` (the public API
and the sign-up form can never assign roles; the tool refuses to run without
`--yes`, preserves other claims and can revoke refresh tokens). The caregiver
signs in once (which provisions their account), copies their **caregiver ID**
from the Caregiver page and gives it to the participant, who enters it on the
Data & privacy page. Nothing is shared before that.

- **Read-only.** A caregiver can read the subject, progress, Digital Twin and its
  history, summaries, reports and sessions. Export, access log, erasure, consent
  changes, session/report creation, check-ins and sharing management are owner-only
  and return 404 to a caregiver. Trial-level events are never exposed to caregivers.
- **Transparent.** Every caregiver read is audited and appears in the participant's
  access log as "another account", without the caregiver's identifier.
- **Revocable by either side.** The owner or the caregiver can end a share;
  re-sharing reuses the same relationship record. Revocation takes effect on the
  next request.
- **Not affected by erasure.** Erasure deletes research data; the share remains
  but there is then nothing to see.

Frontend: `/caregiver` (own ID with copy, what access includes, participants
sharing with them, "stop viewing") and `/caregiver/subjects/{id}` (Twin summary,
saved-run summaries, reports). There is no demo caregiver (sharing is a real choice).
Participants manage sharing from the Data & privacy page.

## Data rights (export, access log, erasure)

Implemented in `backend/app/services/data_rights.py`; owner-only (caregivers,
clinicians and other participants receive 404 and the attempt is audited).
Policy choices, recorded for review:

- **Erasure removes research data, not the account.** The subject record, the
  consent history (a record that consent was granted/withdrawn) and the audit
  log are kept, because they hold no research content and document what happened.
  Consent is withdrawn first so nothing new is collected during deletion; every
  step is safe to repeat after a partial failure.
- **Not covered by erasure:** older summaries written directly to Firestore by
  the pre-API frontend (`users/{uid}/...`), and runs held in a browser tab. The
  Data & privacy page says so. A policy for those legacy records is still open.
- **Retention:** no automatic retention period is enforced; that needs a policy
  decision.
- **Confirmation:** the API requires the exact phrase, and the page requires the
  participant to type it, so a stray or scripted call cannot erase data.

## Frontend API layer (`frontend/src/lib/backend/`, `frontend/src/features/backend/`)

**Mode.** Set `NEXT_PUBLIC_DATA_PROVIDER=firebase` and `NEXT_PUBLIC_API_BASE_URL`
(backend origin, no `/api/v1`) to enable *API-backed Firebase mode*: Firebase
Authentication for identity, FastAPI for CPT persistence. Without a base URL,
Firebase mode behaves exactly as before (direct Firestore summary writes).

- `types.ts` — wire types mirroring `backend/app/schemas.py` (the real contract;
  `frontend/src/types/api.ts` remains an unconnected proposal).
- `client.ts` — `createBackendClient({ baseUrl, getIdToken })`. Sends
  `Authorization: Bearer <Firebase ID token>`, retries once with a
  force-refreshed token after a 401, and reports a missing sign-in as
  `auth-token-unavailable` without calling the network. Errors expose only the
  backend `code` and `requestId` (`ApiClientError.backendCode` / `requestId`);
  server message text is never surfaced.
- `cpt-sync.ts` — `syncScoredCptRun`: find subject → check active research
  consent → idempotent session (`cpt-run-<runId>`) → start → activity start →
  send trial events only → complete → read the server-calculated summary. Every
  step is state-driven, so a failed attempt is retried safely. Never grants
  consent, never creates a subject; practice runs are rejected.
- `sync-controller.ts` — framework-free coordination: read-only `load()`,
  explicit `grantConsent()` (the only place a subject is created, with a fresh
  idempotency key per grant so consent can be re-granted after withdrawal),
  `withdrawConsent()`, `persistRun()`.
- `consent.ts` — **DRAFT placeholder** consent text and version
  (`research-consent-DRAFT-v0`). Not approved by the research team, an ethics
  board or counsel; replace both text and version before real participants use
  it. Guardian/assent handling is not implemented (the backend lets only the
  subject's owner grant consent).
- `features/backend/` — `BackendSyncProvider`, `ApiBackedActivityProvider`
  (saves runs **only** through the API; the direct Firestore CPT write is not
  wired, so no run is written to two stores) and `ResearchConsentCard` on the
  Digital Twin page. Runs that could not be saved (e.g. consent missing) stay in
  the browser session and are retried when consent is granted or on demand.
  Pre-existing Firestore runs remain visible and untouched; the legacy
  Firestore Twin snapshot is no longer updated in this mode.

**Tests.** Unit tests cover the client, sync, controller, mapping and run
de-duplication. `contract.test.ts` runs the real client against the real
FastAPI app (`backend/scripts/serve_test_app.py`, fake auth, in-memory store,
loopback only, refuses to start without `ATTUNE_ALLOW_FAKE_AUTH=1`) and checks
that frontend and backend CPT scoring agree. It is skipped unless
`BACKEND_CONTRACT_URL` is set; CI runs it in the `contract` job.

**Server-backed screens (API-backed mode).** The Digital Twin page shows the
server's Twin (version, accuracy and reaction-time change, quality flags,
provenance) and its immutable version history, plus a reports card
(`POST /subjects/{id}/reports`, key derived from the saved-run count so repeats
return the same report). The session-history page lists backend sessions, with
earlier Firestore sessions kept below as read-only. The direct Firestore report
write is not offered in this mode. `twin.ts` parses the snake_case `profile` /
report `content` objects defensively (unknown or mistyped fields become `null`).

**Truthful privacy wording.** In this mode trial events *are* sent to the
backend (with consent), so every screen that previously said "raw trial events
are never uploaded" now reads `persistenceTarget` from the activity store
(`"firebase"` or `"backend"`) and shows accurate text for the active target.
New screens that describe storage must do the same.

**Real authentication tests.** `backend/tests/test_auth_emulator.py` exercises
the real `verify_firebase_id_token` path with tokens issued by the Firebase Auth
emulator: missing/garbage tokens, profile provisioning, trusted custom-claim
roles, unsupported role claims failing closed, revoked sessions, and cross-user
and clinician isolation. It needs only the Auth emulator (the Firestore
emulator is used when also running, otherwise the in-memory store).

**Data & privacy page** (`/participant/data`, API-backed mode only): consent
control, JSON export download, access log (other accounts shown only as
"another account", with a warning when refused attempts exist) and a
typed-confirmation erasure card. Without a backend it explains that these
controls are unavailable instead of offering ones that do nothing.

**Not yet done.** Dedicated progress endpoint display (progress is shown from
the runs list and the Twin aggregate); consent UI for `eeg_processing` /
`webcam_analysis`; browser tests of Firebase mode (the Auth emulator is now
available for this); real consent wording and guardian flow; a policy for the
legacy Firestore runs (currently kept read-only and merged for display);
pagination beyond the first 50 saved runs / sessions.