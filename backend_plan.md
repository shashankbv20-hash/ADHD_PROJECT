# Backend Development Plan

> **Architecture correction — Firestore-first:** This document preserves the
> original backend requirements and PostgreSQL proposal as project history.
> Firebase Authentication and Cloud Firestore, accessed by FastAPI via the
> Firebase Admin SDK, supersede PostgreSQL as the active persistence architecture.
> The existing participant-owned frontend Firestore paths remain intact; the API
> uses documented subject-scoped collections and does not mirror its records
> into the frontend's legacy activity/session/report/Twin subcollections.
> The original PostgreSQL stack, runtime, migration, cutover, and execution
> instructions below are historical
> and are not current operating instructions. Do not create dual authoritative
> writes. Preserve the current frontend ownership and Firestore rules. See
> [`docs/adr-001-firestore-first.md`](docs/adr-001-firestore-first.md) and
> [`docs/architecture.md`](docs/architecture.md). This correction does not claim
> live Firebase or emulator verification.

> The original requirements history remains: participant ownership, consent,
> provenance, secure handling of sensitive data, validated measures, and honest
> capability reporting continue to apply to future work.

> **Scope of preserved material:** The remainder of this file records the
> original PostgreSQL-centered design, phases, commands, and copy/paste prompts
> for historical traceability. They are not instructions for current runtime
> setup or implementation. In particular, do not run PostgreSQL/SQLAlchemy/
> Alembic setup from this plan as part of the active architecture. Future work
> must follow the Firestore-first ADR unless a newer approved ADR supersedes it.

## ADHD Digital Twin & Interactive Cognitive Activity Platform

**Historical purpose:** This file records the original implementation plan for a backend supporting the ADHD Digital Twin frontend. Its original PostgreSQL-focused phases are retained for requirements history, not current implementation guidance.

**Implementation rule:** Do not treat a planned feature as completed just because code has been scaffolded. Each phase must include working implementation, tests, documentation, and clear evidence of what has and has not been verified.

---

## 1. Project goals — Historical requirements

Build a modular backend that connects the existing Next.js frontend, users and subject profiles, cognitive activities, session/event collection, behavioral analytics, EEG inference, optional webcam-derived features, Digital Twin history, AI Buddy, and reporting.

The platform should:

- Maintain separate, permission-protected records for each subject.
- Collect activity/session measurements and calculate reproducible summaries.
- Integrate the existing trained EEG model in `.pth` format without changing its architecture or preprocessing assumptions until they have been inspected and understood.
- Support optional webcam-based measurements only with explicit consent and clear camera controls.
- Update a longitudinal Digital Twin from validated, traceable observations.
- Continue working when EEG processing or webcam analysis is unavailable.
- Distinguish observed data, calculated metrics, model predictions, synthetic/demo content, and clinical conclusions.
- Connect to the existing frontend without breaking its routes, visual design, demo mode, or working login flows.

This is a research and support platform. An ML prediction must not be described as a confirmed ADHD diagnosis. The AI Buddy must not provide medical diagnoses or medication recommendations.

## 2. Current project context and constraints — Historical snapshot

The frontend is an existing Next.js App Router, React, TypeScript, and Tailwind application. Reported frontend features include participant, clinician, and researcher views; EEG upload/processing UI; CPT activities; activity history; progress views; Digital Twin views; reports; and API integration scaffolding. Some features currently use synthetic or in-memory demo data. The current source tree must be inspected to verify what is actually implemented.

The current frontend work has also included Firebase Web SDK configuration and Firebase Authentication/Firestore service code. A recent development log showed:

- Firebase Authentication login can succeed.
- Reading `users/{uid}` from Firestore failed with `permission-denied` in project `adhd-bf37a`.
- The Firebase Console previously showed deny-all Firestore rules.
- The repository contains `firebase.json`, `firestore.rules`, and `firestore.indexes.json`.
- Firebase CLI `15.34.2` was accessible through `npx firebase-tools`.
- The repository previously had no `.firebaserc`; verify current state before acting.
- The `/participant` route has shown a Next.js Instant Navigation validation warning. This is a frontend issue and is not, by itself, a backend requirement.

Do not assume the Firebase integration is now fixed. Inspect the current files and logs before relying on it.

**Repository reorganization update:** the Next.js application now lives under
`frontend/`; Firebase Web configuration and Firestore rules live beside it.
`.firebaserc` selects `adhd-bf37a`. The local Firestore rules were reviewed and
deployed to that project; the active release was verified to match the local
rules. Earlier development-log permission-denied entries predate that release.
An authenticated browser profile-read/persistence smoke test remains pending.

### Workspace boundaries

- Work only in the explicitly selected `ADHD_NEW` project folder.
- Do not modify or copy code from the old frontend at `ADHD\proto\frontend`.
- Create the Python backend in a clearly separated `backend/` directory unless the current repository already has an established backend location. Confirm the actual layout first.
- Do not put Python server code inside the Next.js `frontend/src/` tree.
- Preserve current frontend behavior and avoid broad rewrites.
- Never print or commit `.env.local`, credentials, access tokens, Firebase service-account JSON, private keys, EEG data, or identifiable subject records.

---

## 3. Required stack — Historical proposal

The Backend Development Report specifies:

| Concern | Required/planned technology |
|---|---|
| API framework | Python + FastAPI |
| Primary relational database | PostgreSQL |
| ORM and schema migrations | SQLAlchemy + Alembic |
| EEG deep learning | PyTorch |
| Numerical/data processing | NumPy, Pandas |
| Webcam/computer vision | OpenCV, MediaPipe |
| Identity | Firebase Auth or Clerk; current frontend has Firebase Auth code, so evaluate Firebase Auth first |
| Communication | REST APIs; WebSockets only where a real-time requirement warrants them |
| AI Buddy | Existing LLM API, configured on the server only |
| Large EEG files | Private object/file storage; persist references and metadata in PostgreSQL, not raw file bytes in relational rows |

Use mutually compatible, pinned dependency versions after inspecting the environment and model requirements. Do not add a heavy dependency without a demonstrated need. Prefer maintainable modular code and explicit configuration.

### Historical architecture proposal (superseded): resolve before writing duplicate data layers

The backend report specifies PostgreSQL as the application's primary database, while the current frontend has been working on Firestore persistence. Do not silently make both Firestore and PostgreSQL authoritative for the same domain records.

**Recommended target architecture, subject to project-owner/team approval:**

1. Firebase Authentication remains the identity provider because it is already integrated in the frontend.
2. The frontend sends the Firebase ID token in `Authorization: Bearer <token>` on FastAPI requests.
3. FastAPI verifies the token server-side using the trusted Firebase Admin SDK / supported application credentials.
4. PostgreSQL becomes the system of record for subjects, consents, sessions, events, measurements, EEG metadata/results, Digital Twin history, and reports.
5. Firestore is not used as a second authoritative store for those same domain records. Keep existing Firestore functionality intact during migration; remove, phase out, or retain it only after explicit review and after the FastAPI/PostgreSQL path is verified end-to-end.
6. Large EEG files are stored in a private object-storage provider selected by the team. Firebase Cloud Storage is a possible option given the existing Firebase setup, but do not assume a provider or expose files publicly.

If the team chooses a different architecture, document it before creating migrations or duplicating writes. Do not infer that Firebase login success means FastAPI authentication is implemented.

### Historical role-model proposal

The backend report names Child, Parent/Caregiver, and Researcher. The existing frontend includes Participant, Clinician, and Researcher. Before enforcing roles across the API, inspect current UI contracts and document a canonical mapping approved by the project owner. A possible mapping to discuss is participant/child, caregiver, clinician, researcher, and a server-managed administrator role. Do not silently equate clinician with caregiver or allow users to self-assign privileged roles.

Use trusted backend authorization, subject ownership checks, and caregiver-subject relationship checks. Any custom claims or privileged roles must be assigned only by a trusted server/admin process, never by a public browser form.

---

## 4. Proposed repository layout — Historical proposal

Adapt to the current repository instead of blindly replacing existing files. A suggested layout is:

```text
ADHD_NEW/
├── frontend/                    # Existing Next.js app; preserve it
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── package-lock.json
│   ├── firebase.json
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   ├── .firebaserc
│   ├── .env.example
│   ├── .env.local                # Local-only; ignored
│   └── docs/                     # Frontend-specific documentation
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/                # Settings, logging, security
│   │   ├── api/v1/              # Versioned route registration
│   │   ├── auth/                # Firebase ID-token verification, role guards
│   │   ├── db/                  # SQLAlchemy engine, sessions, Base
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── repositories/        # Database access
│   │   ├── services/            # Business logic
│   │   ├── analytics/           # Cognitive activity metrics
│   │   ├── eeg/                 # Validation, preprocessing, model loading/inference
│   │   ├── webcam/              # Optional consent-gated feature extraction
│   │   ├── digital_twin/        # Versioned longitudinal profile logic
│   │   ├── ai_buddy/            # Server-side LLM client and safety constraints
│   │   └── storage/             # Private object storage abstraction
│   ├── alembic/
│   ├── tests/
│   ├── scripts/                 # Safe development utilities only
│   ├── alembic.ini
│   ├── pyproject.toml            # Or requirements/lock file, choose one approach
│   ├── .env.example              # Names/placeholders only; no secrets
│   └── README.md
├── docs/                         # Shared architecture/progress documents
├── backend_plan.md
├── README.md
└── .gitignore
```

Do not generate every module as an empty placeholder. Create structure as phases need it. Keep routers thin; put business rules in services and database operations in repositories or a consistent equivalent layer.

---

## 5. Data model requirements — Historical proposal

The Backend Development Report names these major entities. Inspect the real frontend contracts and project requirements before finalizing column details, indexes, retention, and foreign-key relationships.

1. Users
2. Subjects
3. Caregiver Relationships
4. Consent Records
5. Activity Definitions
6. Activity Configurations
7. Sessions
8. Activity Trials
9. Activity Events
10. Activity Summaries
11. Feeling Check-ins
12. Webcam Feature Records
13. EEG Recording References
14. EEG Predictions
15. Digital Twin Profiles
16. Digital Twin History
17. Audit Logs

Additional supporting tables (such as model versions, analysis jobs, or AI Buddy conversation metadata) may be introduced only where they serve a documented feature.

### Minimum modeling expectations

- Use generated internal primary keys and stable public IDs as appropriate.
- Store Firebase UID as a unique external identity identifier if Firebase Auth is retained.
- Use UTC timestamps consistently.
- Use foreign keys and indexes for subject/session ownership and common history lookups.
- Model caregiver-to-subject access explicitly; never infer access merely because a user knows a subject ID.
- Store consent version, timestamp, scope, actor, and revocation/withdrawal status as appropriate. Enforce consent before optional webcam or EEG processing where required.
- Keep activity events/trials distinct from server-calculated summaries.
- Record data provenance, schema version, calculation/model version, and quality flags where relevant.
- Record EEG file object keys/URIs and metadata in PostgreSQL; do not store large raw recordings in Firestore or ordinary relational text columns.
- Record Digital Twin history rather than destructively overwriting all historical states. The current profile may be a derived pointer or snapshot.
- Add audit events for important access/consent/role/data-export/deletion actions, avoiding unnecessary sensitive payload copies.
- Do not add sensitive demographics unless they are needed and authorized for the research protocol.

### Example relationship outline

- User can have zero or more subject/caregiver relationships according to assigned role.
- Subject has many consents, sessions, and longitudinal measurements.
- Session has associated activities, trials/events, check-ins, optional webcam summaries, optional EEG recordings/predictions, and derived summaries.
- A Digital Twin profile belongs to one subject and has many versioned history records.
- Reports refer to existing sessions/subjects and record the generating logic/version.

Finalize this ERD from the report and actual use cases before the first production migration. Keep migrations reversible where reasonably possible.

---

## 6. API contract strategy — Historical proposal

Use a versioned prefix such as `/api/v1`. Define Pydantic request and response schemas, consistent error responses, input limits, pagination, and OpenAPI documentation. Do not use endpoint names as an excuse to return invented or hard-coded results.

Suggested initial endpoints (adjust after inspecting
`frontend/src/types/api.ts` and existing frontend calls):

### Health and identity

- `GET /health/live` — process liveness; no secrets.
- `GET /health/ready` — readiness including safe database connectivity check.
- `GET /api/v1/users/me` — current authenticated account/profile summary.
- `PATCH /api/v1/users/me` — update only approved profile fields.

Firebase handles sign-in if that is the approved identity architecture; do not implement an unrelated password database in FastAPI.

### Subjects, relationships, and consent

- `POST /api/v1/subjects`
- `GET /api/v1/subjects/{subject_id}`
- `PATCH /api/v1/subjects/{subject_id}`
- `POST /api/v1/subjects/{subject_id}/caregivers`
- `DELETE /api/v1/subjects/{subject_id}/caregivers/{relationship_id}` (only if policy permits)
- `POST /api/v1/subjects/{subject_id}/consents`
- `GET /api/v1/subjects/{subject_id}/consents`
- Consent withdrawal/status endpoints according to the approved policy.

Subject and caregiver access must be enforced server-side for every request.

### Activity catalog and sessions

- `GET /api/v1/activities`
- `GET /api/v1/activities/{activity_id}`
- `POST /api/v1/sessions`
- `GET /api/v1/sessions`
- `GET /api/v1/sessions/{session_id}`
- `POST /api/v1/sessions/{session_id}/start` (if distinct from create)
- `POST /api/v1/sessions/{session_id}/complete`
- `POST /api/v1/sessions/{session_id}/events:batch` or an equivalent clearly documented event-ingestion route.
- `GET /api/v1/sessions/{session_id}/summary`

Support event validation, idempotency or duplicate-event detection, pause/resume where appropriate, timestamps, and clear session state transitions.

### Feeling check-ins and analytics

- `POST /api/v1/sessions/{session_id}/feeling-checkins`
- `GET /api/v1/subjects/{subject_id}/progress`
- `GET /api/v1/subjects/{subject_id}/activity-summaries`
- Activity-specific summary endpoints only where required by the current frontend.

Calculate accuracy, reaction-time statistics/variability, hits, misses, false alarms, omission/commission errors, completion times, and block-level changes from validated events. Document denominator and missing-data behavior. Do not treat all activity types as if they shared identical scoring rules.

### EEG ingestion and analysis

- Request a short-lived upload target or use a secure authenticated upload route.
- `POST /api/v1/subjects/{subject_id}/eeg-recordings` — create metadata/reference after validation.
- `POST /api/v1/eeg-recordings/{recording_id}/analyze` — trigger analysis; asynchronous job status may be necessary for large recordings.
- `GET /api/v1/eeg-recordings/{recording_id}`
- `GET /api/v1/eeg-recordings/{recording_id}/predictions`

Validate allowed file size/format, channel names/count, sampling rate, duration, and quality based on the existing model's actual requirements. Do not accept arbitrary files and pass them directly into `torch.load`. Avoid unsafe deserialization and follow PyTorch's safe loading options appropriate to the existing artifact.

Prediction responses should include supported fields such as class/output, probabilities only if the model supports them, model version, timestamp, quality information, and appropriate limitations. Never claim a diagnostic validity level that has not been established.

### Webcam features

- A session-bound route for consented feature batches or summaries, chosen based on the real-time requirement.
- WebSocket only if justified by live streaming; REST batch uploads are simpler for many initial use cases.
- Store feature values, timestamps, tracking confidence, model/version, and data-quality status. Do not store raw video by default.

### Digital Twin, reports, and AI Buddy

- `GET /api/v1/subjects/{subject_id}/digital-twin`
- `GET /api/v1/subjects/{subject_id}/digital-twin/history`
- A controlled update/recompute service triggered by eligible validated measurements; avoid an unrestricted client-controlled profile write endpoint.
- `GET /api/v1/subjects/{subject_id}/reports`
- `POST /api/v1/ai-buddy/messages` if the LLM integration is approved and configured.

The AI Buddy key must remain server-side. Support activity instructions, explanations, hints, navigation help, and optional breaks. Do not produce medical diagnoses or medication advice.

### Endpoint design rules

- Every private endpoint verifies identity and authorization.
- Querying by ID alone never proves ownership.
- Return minimal fields appropriate to the viewer's role.
- Apply pagination to histories/event streams.
- Limit batch size and uploaded content size.
- Use idempotency keys or deduplication where retries could create duplicate sessions/events/jobs.
- Never include secrets, raw webcam frames, or entire EEG content in JSON logs/responses.

---

## 7. Backend modules and implementation phases — Historical plan; not current instructions

Build the backend incrementally. Complete and test one phase before starting the next; do not ask the coding agent to invent the entire system in one giant code-generation step.

### Historical Phase 0 — Repository discovery and architecture decisions

**Tasks**

- Inspect the existing frontend routes, API types/client, Firebase services, roles, demo/provider modes, package scripts, and current file layout.
- Inspect model artifact locations and read any model/preprocessing documentation without modifying the artifact.
- Verify Python availability and project conventions.
- Document how Firebase identity is passed to the API and decide the source of truth for domain records.
- Reconcile Child/Caregiver/Researcher with Participant/Clinician/Researcher.
- Confirm target storage provider and development database workflow.
- Produce a concise architecture decision record before creating database migrations.

**Acceptance criteria**

- No existing frontend files are broken or overwritten.
- Architecture choices and unresolved questions are listed explicitly.
- PostgreSQL is the planned relational system of record unless the project owner explicitly chooses otherwise.
- Current Firestore data is not deleted and no rules are weakened.

### Historical Phase 1 — Backend foundation and database

**Tasks**

- Create FastAPI app and versioned router structure.
- Add typed settings loaded from backend environment variables.
- Add safe logging and central exception handling.
- Configure PostgreSQL/SQLAlchemy and Alembic.
- Add `/health/live` and `/health/ready`.
- Add Firebase ID-token verification if Firebase Auth is the approved provider.
- Add common authorization dependencies and response/error schemas.
- Add local development instructions and `.env.example` containing placeholder values only.

**Acceptance criteria**

- App starts locally through documented commands.
- Readiness reports database connectivity without leaking connection strings.
- A valid Firebase token is accepted; missing/invalid/expired tokens receive appropriate 401 responses.
- CORS allows only configured development/production frontend origins.
- Initial migrations can be applied and schema state verified.
- Secrets are excluded from version control.

### Historical Phase 2 — Users, subjects, relationships, and consent

**Tasks**

- Create schema/migrations for users, subjects, caregiver relationships, and consents.
- Map authenticated Firebase UID to a local user record using a safe idempotent provisioning/get-or-create flow.
- Add role and subject authorization guards.
- Enforce caregiver relationships and subject-level access.
- Model consent capture, scope, revocation, and audit events.

**Acceptance criteria**

- Authenticated users cannot read or modify another user's private records without an explicit authorized relationship.
- Privileged roles cannot be selected and trusted by a public frontend form.
- Consent-dependent functionality is blocked without current required consent.
- Tests cover unauthorized and cross-subject access.

### Historical Phase 3 — Activities, sessions, events, and cognitive scoring

**Tasks**

- Model activity definitions/configurations, sessions, activity assignments, events/trials, and summaries.
- Read the existing frontend's CPT and other event schemas before finalizing models.
- Build safe session lifecycle transitions.
- Add batch event ingestion with validation and idempotency/deduplication.
- Calculate activity-specific metrics on the server using documented rules.
- Start with currently implemented frontend activities, particularly CPT; do not invent the behavior of unimplemented activities.

**Acceptance criteria**

- A test session can be created, receive validated events, and be completed.
- Server-derived summaries are reproducible from stored events.
- Invalid counts/timestamps/event transitions are rejected.
- Repeated requests do not create duplicate sessions or duplicate event effects.
- Practice runs are not accidentally classified as scored runs.

### Historical Phase 4 — Feeling check-ins, behavioral analytics, and progress APIs

**Tasks**

- Add optional pre/post-session feeling check-ins and optional context such as self-reported sleep, only as approved.
- Generate activity-wise/session-wise summaries.
- Provide progress/history endpoints with pagination and role filtering.
- Track missing measurements and data quality.

**Acceptance criteria**

- Optional data can be absent without breaking the session workflow.
- Progress views are calculated from persisted records, not hard-coded or synthetic values when real mode is selected.
- The frontend receives stable typed response contracts.

### Historical Phase 5 — Digital Twin and reports

**Tasks**

- Implement subject-specific baseline and longitudinal profile logic.
- Update only from eligible validated sessions and measurements.
- Store versioned history, source record IDs, timestamps, provenance, algorithm/version, and data-quality state.
- Generate report data from persisted summaries.
- Keep recorded observations distinct from derived metrics and ML predictions.

**Acceptance criteria**

- A new eligible session updates the profile according to documented rules.
- Historical snapshots remain inspectable.
- Empty/insufficient data yields an explicit insufficient-data state rather than fabricated values.
- Reports expose only role-authorized information.

### Historical Phase 6 — Existing EEG model integration

**Tasks**

1. Locate the `.pth` model and any original model definition, labels, expected inputs, training scripts, preprocessing code, dependencies, and evaluation report.
2. Document model architecture, input shapes, channel order, sampling frequency, filtering/segmentation/normalization, label mapping, and inference output before coding the adapter.
3. Preserve the original artifact and preprocessing pipeline. Do not silently retrain, change input normalization, rename labels, or alter the model architecture.
4. Implement EEG file/metadata validation and quality checks.
5. Implement preprocessing as an explicitly tested pipeline that matches training-time logic.
6. Load the model safely and manage model lifecycle deliberately; do not reload large weights for every request unnecessarily.
7. Implement controlled inference, model/version metadata, prediction persistence, and analysis-job status if inference is long-running.
8. Store file references in PostgreSQL and payloads in private object storage.

**Acceptance criteria**

- A documented test sample matching the model's expected input can pass the complete preprocessing/inference pipeline.
- The same input and model version produce stable results within the expected tolerance.
- Invalid format, channels, sampling rate, duration, or signal quality is rejected with a useful error.
- Model output and limitations are accurately represented; confidence/probabilities are included only if supported.
- Missing model files or dependencies produce an explicit unavailable state—not a fake prediction.
- The model is not described as clinically validated without evidence.

### Historical Phase 7 — Optional webcam behavioral analysis

**Tasks**

- Select compatible existing models/libraries for the requested supported features.
- Require explicit consent and camera activation.
- Extract only supported features: blink rate, approximate gaze direction, head movement/orientation, face visibility, upper-body movement where supported, and tracking confidence.
- Timestamp features and associate them with the subject/session/activity.
- Avoid saving raw video by default; avoid logging frames or identifiable content.
- Define behavior when the camera is unavailable or tracking confidence is low.

**Acceptance criteria**

- Webcam processing is optional and does not block EEG or cognitive activity workflows.
- No raw video is stored by default.
- Consent withdrawal stops further processing as appropriate.
- Unsupported signals/features are omitted or explicitly marked unavailable rather than invented.

### Historical Phase 8 — AI Buddy integration

**Tasks**

- Inspect the existing approved LLM provider/API and current frontend expectations.
- Add a backend-owned LLM client, timeout/error handling, rate limits, and safe prompt/context construction.
- Provide child-appropriate activity instructions, explanations, hints, navigation help, and optional break suggestions.
- Avoid medical diagnoses, medication advice, and claims that the assistant can determine whether a child has ADHD.
- Minimize personal data sent to the provider and avoid sending raw EEG/video.

**Acceptance criteria**

- Missing/failed LLM configuration gives a clear unavailable response without breaking the rest of the app.
- Provider keys remain server-side.
- Responses follow the defined scope and are auditable without recording unnecessary sensitive conversation content.

### Historical Phase 9 — Frontend integration, security, testing, and deployment

**Tasks**

- Compare backend OpenAPI schemas with `frontend/src/types/api.ts` and the central frontend API client.
- Add/adjust typed frontend requests only after confirming the backend contract.
- Keep demo mode working and clearly separated from real API mode.
- Add API, repository, analytics, access-control, and model-integration tests.
- Test cross-user and cross-role access denial.
- Add deployment settings, migrations/runbook, backup and recovery guidance, structured logs, and health checks.
- Verify CORS, rate limits, upload limits, storage permissions, retention/deletion workflow, and secrets handling.

**Acceptance criteria**

- The full flow works with synthetic test data: login → subject/session → activity events → calculated summary → optional analysis → Digital Twin/report → reload/history retrieval.
- All important tests are reported with actual outcomes.
- Deployment documentation is reproducible.
- Any incomplete module is identified honestly and does not masquerade as functional.

---

## 8. Privacy, authorization, and safety requirements — Historical requirements

These requirements apply to every phase:

- Verify identity on the backend for every private request.
- Enforce role, subject ownership, and caregiver relationship authorization server-side.
- Never trust a `uid`, role, subject ID, consent flag, or privilege supplied by the browser without server-side verification.
- Use least-privilege database credentials; never expose database URLs/passwords or Admin SDK credentials to the frontend.
- Do not permit unrestricted CORS, public EEG files, or public Firestore rules.
- Require explicit consent for optional webcam analysis and any required research processing.
- Raw video should not be persisted by default.
- Store EEG recordings in private object storage with controlled access, upload limits, content validation, and retention/deletion policies.
- Do not write raw EEG values, video frames, full access tokens, credentials, or unnecessary child-identifying data into application logs.
- Record audit events for role, consent, sensitive access, data export, and deletion operations as appropriate.
- Define data export/deletion behavior and how related object-storage files are handled.
- Do not present model output as a diagnosis or substitute for professional assessment.
- Do not use production children's data for developer testing; use synthetic/anonymized approved samples and developer-controlled test identities.

---

## 9. Testing strategy — Historical proposal

Use the test tools that fit the repository and model dependencies; confirm installed tooling rather than assuming it exists. A reasonable starting point is `pytest` for unit/API tests and a dedicated test PostgreSQL database for integration tests.

Cover at minimum:

1. Token validation: missing, malformed, invalid, expired, and valid tokens.
2. Role and ownership: participant, caregiver, clinician/researcher if approved; cross-subject denial.
3. Consent: granted, missing, and revoked.
4. DB migrations: new database upgrade and schema validation.
5. Session state transitions and event idempotency.
6. Activity metric correctness using known fixtures and edge cases.
7. Pagination and role-sensitive response filtering.
8. EEG file validation and preprocessing equivalence against approved test fixtures.
9. Missing model artifact/dependency behavior.
10. Webcam disabled, no-face, low-confidence, and consent-disabled paths.
11. Digital Twin baseline, update, history, and insufficient-data behavior.
12. AI Buddy provider timeout/missing-key behavior.
13. Frontend API contract integration and data retrieval after reload.

Do not claim browser, database, live model, or deployment tests were run unless they actually were.

---

## 10. Environment and run commands — Historical proposal

OpenCode must inspect the environment and write exact commands into `backend/README.md` after the scaffold is created. The final instructions should cover:

- Supported Python version and virtual environment creation.
- Dependency installation and dependency locking.
- Copying `backend/.env.example` into a local, ignored backend env file.
- Configuring database URL, identity verification credentials, CORS origins, object-storage settings, and optional model/LLM locations.
- Starting the development PostgreSQL database through an agreed local method (Docker Compose if available, otherwise documented installed-PostgreSQL alternative).
- Running Alembic migrations.
- Starting FastAPI with a development server.
- Running lint/tests/type checks if configured.
- Connecting the Next.js frontend to the local API using its existing API client and environment variable, without breaking Firebase login or demo mode.

Use placeholder values only in `.env.example`. Never place real keys in documentation. Do not start or deploy a production service without verifying the target and obtaining the necessary authorization.

---

## 11. OpenCode execution protocol — Historical instructions

OpenCode should not implement the entire backend in one enormous generation pass. Use a fresh focused task per phase while keeping this file as the source of truth.

For every phase:

1. Read this `backend_plan.md` in full or read the relevant sections and summarize the acceptance criteria.
2. Inspect the current code before changing anything.
3. State any unresolved decision that blocks safe implementation. Do not silently invent a data contract, dataset format, model architecture, or role mapping.
4. Implement only the current phase and necessary supporting tests/docs.
5. Run the checks actually available.
6. Review the diff for secrets, unrelated frontend changes, weakened authorization, and accidental file/data deletion.
7. Update `backend/README.md` and phase status in `docs/backend_progress.md` (create it if needed) with completed items, tests/results, unresolved blockers, and next steps.
8. Report exact paths changed and distinguish code-complete from runtime-tested.
9. Proceed to the next phase only after the current acceptance criteria pass, or clearly record the blocker.

Do not treat a successful import, compile, or FastAPI startup as proof that all business functions work.

---

## 12. Copy-paste master prompt for OpenCode — Historical prompt; do not use as current instructions

Use this prompt with the OpenCode workspace set to `ADHD_NEW`:

> Read `backend_plan.md` completely and treat it as the backend requirements and phased implementation plan for this repository. First inspect the current frontend/API contracts, Firebase integration, existing files, available Python/runtime tools, current dataset/model artifacts, and the repository state. Do not modify the old frontend or rebuild the existing Next.js app. Implement the backend in a separate `backend/` directory unless an existing backend layout is already established. Follow the phases and acceptance criteria in `backend_plan.md`; start with Phase 0 (discovery and architecture decisions), then Phase 1 (backend foundation) only after documenting the unresolved architecture decisions. The target stack is FastAPI + PostgreSQL + SQLAlchemy + Alembic, with Firebase Authentication verified server-side if the existing Firebase identity provider is retained. PostgreSQL is the planned source of truth for domain data; do not create duplicate authoritative Firestore/PostgreSQL writes without an explicit architecture decision. Preserve any `.pth` model and training-time preprocessing; do not fabricate inference results or alter the model without evidence. Keep EEG object storage private and webcam analysis optional/consent-gated. Inspect before editing, make focused changes, add tests, run real checks, update `docs/backend_progress.md`, and provide a precise report of files changed, outcomes, blockers, and next phase. Never expose secrets, weaken access rules, deploy to an unverified cloud target, or claim unperformed tests. Do not attempt to generate every backend module in one pass. Finish Phase 0 and Phase 1 only in this task, unless Phase 0 proves that a necessary decision blocks Phase 1; then document the blocker and complete all safe discovery work.

### Historical prompts for following phases — do not use as current instructions

After Phase 1 is verified, use one prompt at a time:

**Historical Phase 2 prompt**

> Read `backend_plan.md` and `docs/backend_progress.md`. Implement Phase 2 only: user/subject profiles, caregiver relationships, consent records, trusted identity mapping, role/subject authorization, migrations, tests, and documentation. Preserve existing frontend behavior. Do not start activity management until Phase 2 acceptance criteria pass. Report exact tests and unresolved decisions.

**Historical Phase 3 prompt**

> Read `backend_plan.md` and progress notes. Implement Phase 3 only: activity definitions, sessions, lifecycle transitions, trials/events, idempotent event ingestion, and server-side scoring for activities actually present in the current frontend (begin with CPT). Derive schemas from current frontend contracts, add tests using known fixtures, and do not invent unimplemented task semantics. Do not start EEG or webcam modules in this phase.

**Historical Phase 4–5 prompt**

> Read `backend_plan.md` and progress notes. Implement Phase 4 (feeling check-ins, analytics, and progress APIs) and then Phase 5 (versioned Digital Twin and reports), provided Phase 3 is passing. Keep observations, derived metrics, model predictions, and synthetic data distinguishable. Add tests for missing data, access control, reproducibility, and history.

**Historical Phase 6 prompt**

> Read `backend_plan.md` and inspect the exact `.pth` artifact and all accompanying model/preprocessing files. Implement Phase 6 only. Before coding, report the discovered model architecture, expected input shape, sampling rate, channel order, preprocessing/normalization, label mapping, and dependencies. Preserve the existing artifact and preprocessing. If model files or requirements are missing, do not fabricate a model; implement safe validation/interfaces and report the exact blocker. Add equivalence tests with approved sample data where available.

**Historical Phase 7 prompt**

> Read `backend_plan.md` and progress notes. Implement Phase 7 only: optional, consent-gated webcam-derived feature processing using supported models/libraries. Do not store raw video by default or invent unsupported feature estimates. Add tests for disabled consent, no face, low confidence, and unavailable camera/model states.

**Historical Phase 8 prompt**

> Read `backend_plan.md` and progress notes. Implement Phase 8 only using the project's already selected LLM provider if it is documented and configured. Keep credentials server-side, add timeouts/rate limits/error states, and constrain the AI Buddy to activity instructions and supportive guidance without diagnosis or medication advice. If the provider is not specified, implement only an interface/configuration contract and report the decision required.

**Historical Phase 9 prompt**

> Read `backend_plan.md` and progress notes. Implement Phase 9 only after the prior completed phases pass. Align the backend OpenAPI contract with the existing Next.js API client/types, preserve demo mode, test the complete synthetic-data flow, test cross-user/role denial, document deployment and rollback, and report actual results. Do not claim live deployment or browser verification unless performed.

---

## 13. Definition of done — Historical acceptance criteria

The backend is complete only when the agreed modules are implemented and tested, not merely scaffolded. The final acceptance report must list:

- Architecture decisions and any remaining unresolved choices.
- Actual database schema and migration status.
- Authentication and authorization behavior verified by tests.
- Session/event ingestion and activity calculation test results.
- Whether the existing EEG model was successfully integrated and tested, including exact model artifact/version and preprocessing provenance.
- Whether webcam and AI Buddy are implemented, and their disabled/unavailable behavior.
- Digital Twin and report behavior with real persisted source records.
- Frontend integration results, with demo and real modes clearly separated.
- Lint/type-check/test/build outcomes and any environment limitations.
- Deployment status, which must remain explicitly “not deployed” unless deployment was actually performed and verified.
- Remaining bugs, limitations, and next steps.

**Do not claim the project is clinically validated or ready for real patient use simply because the backend runs.** Any clinical validation, institutional approval, regulatory review, or real-subject deployment requires separate evidence and authorization.
