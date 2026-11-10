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

- `python -m pytest -q` from `backend/` runs every API/repository test against
  the in-memory repository, and, when `FIRESTORE_EMULATOR_HOST` is set (see
  `backend/scripts/run-emulator-tests.ps1` and CI), against the Firestore
  emulator too: **59 passed** (32 in-memory + 27 emulator), synthetic data only.
- The emulator run found and fixed a real defect: Twin history was written to
  the invalid path `subjects/{id}/digitalTwin/history/{historyId}`, so scored
  session completion returned 503 on real Firestore while passing in memory.
  History now lives in `subjects/{id}/digitalTwinHistory/{historyId}`; the
  in-memory repository now rejects invalid path shapes. No live data existed
  at the old path.
- `ruff check`, `ruff format --check`, `compileall` and `pip check` pass.
- Frontend: `npm run lint`, `typecheck`, `npm test` (Vitest unit tests) and
  `npm run test:e2e` (Playwright smoke tests against a production demo build)
  are wired into CI (`.github/workflows/ci.yml`).
- Not verified: live Firebase Auth tokens, a real Firestore project, Firestore
  rules (no rules-unit-tests yet), and browser tests of Firebase mode.
