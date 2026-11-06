# Attune ADHD Digital Twin Workspace

The repository contains the existing Next.js frontend and a FastAPI backend.
The active identity/persistence architecture is Firebase Authentication plus
Cloud Firestore; PostgreSQL was intentionally superseded and its prior backend
implementation is archived. See [ADR-001](docs/adr-001-firestore-first.md).

## Repository layout

```text
ADHD_NEW/
├── frontend/          Existing Next.js app and Firebase Web configuration
├── backend/           FastAPI, Firebase Admin Firestore repository, and tests
│   └── archive/        Inactive preserved PostgreSQL/SQLAlchemy/Alembic files
├── docs/              ADR, collection design, API contract, and progress
├── backend_plan.md    Original PostgreSQL requirements history + correction
└── README.md
```

## Run the frontend

Run commands from `frontend/`. In PowerShell:

```powershell
Set-Location -LiteralPath "C:\Users\Vln Rao\OneDrive\Desktop\ADHD_NEW\frontend"
npm ci
npm run dev
```

Other scripts: `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run start`. The repository root intentionally has no `package.json`.

## Firebase boundaries

Firebase Web Auth/configuration and current participant-scoped Firestore
services/rules remain under `frontend/`. Existing data paths include
`users/{uid}`, `users/{uid}/activityRuns/{runId}`,
`users/{uid}/appSessions/{sessionId}`, `users/{uid}/reports/{reportId}`, and
`users/{uid}/digitalTwin/current`. This data is preserved; no rules are weakened
and no data is automatically migrated or deleted.

FastAPI verifies Firebase ID tokens and uses the Firebase Admin SDK for
Firestore. The API stores backend-authoritative subject/session/event/summary/
consent/report/Twin data under subject-scoped documents, rather than copying it
into the frontend's legacy user subcollections. When a frontend operation is
cut over to the API, disable its direct Firestore write for that same operation.
No frontend API cutover is implemented yet.

Never put Admin credentials, service-account JSON, private keys, or other
privileged secrets in frontend code or `NEXT_PUBLIC_*` variables. The frontend
Firestore Rules remain restrictive; Admin SDK operations are separately
authorized in FastAPI because they bypass Firestore Rules.

## Run the backend (no PostgreSQL/Docker)

Follow [`backend/README.md`](backend/README.md). In short, create local
`backend/.env` from `.env.example`, configure the approved Firebase project and
Application Default Credentials, install pinned Python dependencies, and run:

```powershell
Set-Location -LiteralPath "C:\Users\Vln Rao\OneDrive\Desktop\ADHD_NEW\backend"
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

No PostgreSQL service or Alembic migration is required. Run synthetic tests
with `python -m pytest -q`.

## Status and limitations

FastAPI persistence, access control, consent-aware CPT sessions/scoring,
analytics, reports, and versioned Digital Twin history use a Firestore repository.
Tests use an in-memory repository. No Firestore Emulator Suite or live Firebase
Auth/Firestore read/write verification is claimed. EEG inference remains blocked
by missing model/preprocessing artifacts; webcam extraction lacks an approved
extractor/policy; AI Buddy lacks a configured approved LLM provider. Raw EEG and
webcam video are not stored in Firestore.

Read [architecture](docs/architecture.md), [API integration](docs/api_integration.md),
[backend progress](docs/backend_progress.md), and the original
[backend requirements history](backend_plan.md) before further changes.
