# Backend Progress

## Architecture correction and implementation

Firebase Authentication plus Cloud Firestore supersede the original PostgreSQL
proposal. The original requirements and proposal remain in `backend_plan.md` as
history, with an explicit correction note. The frontend is preserved and its
existing Firebase provider/rules were inspected but not changed. See
[ADR-001](adr-001-firestore-first.md) for persistence and cutover boundaries.

- Firebase Admin verifies signed ID tokens; UID and allowlisted role come from
  the verified claims. Unknown roles fail closed; public API payloads cannot set
  identity or role.
- Firestore repository implementation lives in `backend/app/repositories/`;
  `InMemoryRepository` supports deterministic unit/API tests.
- Existing frontend-compatible `users/{uid}` profile is preserved. Server role
  metadata is separate at `backendUsers/{uid}`. Subject records, caregiver
  relationships, consents, sessions/activities/events, summaries, reports,
  Twin history and audit events use documented Firestore paths.
- Session creation, consent transitions, event idempotency, report creation,
  caregiver relationships and Twin history use transactions. Consent is checked
  in the same transaction for data collection; pause/cancel remain stop controls.
- FastAPI CPT validation/scoring, analytics, report generation, Twin versions,
  authorization and API response contracts were retained. The API does not write
  the frontend's `users/{uid}/appSessions`, `activityRuns`, `reports`, or
  `digitalTwin/current` paths.
- PostgreSQL-specific code was preserved under
  `backend/archive/postgresql_legacy/` and is inactive. No database or cloud
  resources were deleted.

## API implementation status

Implemented routes include health/readiness and capabilities; `/api/v1/users/me`;
subject CRUD; caregiver relationship grant/list/revoke; consent grant/list/
withdrawal; activity catalog; session lifecycle and listing; activity start,
event batch, completion/skip; feeling check-ins and session summaries; subject
progress, paginated summaries, Twin current/history and reports. AI Buddy returns
an explicit 503 unavailable response. EEG/webcam inference routes do not pretend
to exist or return simulated outputs.

API schemas and endpoint behavior are documented in [`api_integration.md`](api_integration.md).
The frontend does not yet obtain/send an ID token to these routes. Existing
Firebase profile and demo cloud-sync behavior remains intact until a deliberate
adapter and ownership cutover is implemented.

## Firestore document layout and indexes

See [ADR-001](adr-001-firestore-first.md) and
[`firestore_indexes.md`](firestore_indexes.md). Frontend-owned user subcollections
are preserved and not mirrored. Larger EEG recordings are planned for private
object storage; raw EEG and webcam video are not put into Firestore.

## Phase status

| Area | Status | Evidence / limitation |
|---|---|---|
| Repository and architecture | Implemented | Existing frontend Firebase paths and rules inspected; ADR records document layout and access boundaries. No rules deployment performed. |
| Auth and Firestore foundation | Implemented; unit/API tested | Firebase Admin verifier and Firestore repository; missing project/ADC leaves runtime store unavailable safely. No live token/read/write check. |
| User/subject/caregiver/consent | Implemented; unit/API tested | Frontend-compatible profile shape, trusted role projection, explicit relationship, transactional consent. |
| Activities/sessions/CPT | Implemented for CPT; unit/API tested | Transactional lifecycle and idempotent trial docs; deterministic current frontend 6-trial practice/24-trial scored contract. |
| Check-ins/analytics/reports/Twin | Implemented; unit/API tested | Persisted subject-scoped data, stable cursor ordering, transactional idempotency and version history. |
| EEG model | Blocked | No `.pth` artifact or training/preprocessing docs found. Metadata path is reserved; no predictions fabricated. |
| Webcam | Blocked | No approved extractor/input contract/consent protocol; raw video not stored. |
| AI Buddy | Provider-blocked | No approved LLM provider/credential; explicit unavailable response. |
| Frontend API cutover | Not done | Firebase token injection/provider mapping and deliberate direct-write disablement remain. No frontend source/routes changed. |

## Validation

- `python -m pytest -q` from `backend/`: **18 passed** (synthetic data and
  in-memory repository; no Docker/database required).
- `ruff check app tests`, `ruff format --check app tests`,
  `python -m compileall -q app tests`, and `pip check` passed.
- Frontend `npm run lint`, `npm run typecheck`, and `npm run build` passed; the
  generated route list matches the existing application routes.
- No Firestore Emulator Suite run. No live Firebase Auth or Firestore database
  operation was verified because no developer ADC/test identity was supplied.
- Frontend was not modified; lint/typecheck/build are to be rerun for the final
  repository check.
