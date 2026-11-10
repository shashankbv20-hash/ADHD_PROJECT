# Attune FastAPI Backend

FastAPI uses Firebase Authentication for verified identity and Cloud Firestore
through the Firebase Admin SDK for application persistence. PostgreSQL,
SQLAlchemy, Alembic and the former local PostgreSQL Compose service are archived
under `backend/archive/postgresql_legacy/`; none is an active runtime dependency.
The original PostgreSQL requirements remain historical in `../backend_plan.md`.

The backend keeps the frontend-compatible `users/{uid}` profile shape and uses
subject-scoped Firestore documents for API-owned sessions, event records,
consents, summaries, reports, and Twin history. Existing frontend records are
not migrated, deleted, copied, or dual-written. Current frontend auth/provider
behavior remains intact; API token injection and deliberate cutover remain
future work. See [`../docs/adr-001-firestore-first.md`](../docs/adr-001-firestore-first.md)
and [`../docs/api_integration.md`](../docs/api_integration.md).

## Local setup (PowerShell; no PostgreSQL or Docker)

1. From the backend directory, make a local environment file and keep it
   uncommitted:

   ```powershell
   Set-Location -LiteralPath "C:\Users\Vln Rao\OneDrive\Desktop\ADHD_NEW\backend"
   Copy-Item .env.example .env
   ```

   Set `FIREBASE_PROJECT_ID` to the project ID used by the approved Firebase
   environment. `FIRESTORE_DATABASE_ID` defaults to `(default)`. Never place a
   service-account key or private credential in frontend code or commit it.

2. Create the environment and install the pinned backend/test dependencies:

   ```powershell
   py -3.13 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements-dev.txt
   ```

3. For a developer-owned Firebase project, configure Application Default
   Credentials (for example, `gcloud auth application-default login`). No local
   database or migration step is required.

4. Start FastAPI from `backend/`:

   ```powershell
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

   - Liveness: `http://127.0.0.1:8000/health/live`
   - Firestore readiness: `http://127.0.0.1:8000/health/ready`
   - OpenAPI: `http://127.0.0.1:8000/docs`

   If Firebase project configuration or credentials are unavailable, liveness
   remains usable and readiness/protected operations fail safely. Do not point
   this app at production child data for local testing.

5. Optional emulator development can set `FIRESTORE_EMULATOR_HOST` (and, if
   using Auth Emulator tokens, `FIREBASE_AUTH_EMULATOR_HOST`) to an already
   running Firebase Emulator Suite. Unit tests do not require Docker, emulator,
   network access, or developer credentials.

## Checks

Run from `backend/`:

```powershell
python -m pytest -q
python -m compileall -q app tests
ruff check app tests
ruff format --check app tests
```

### Firestore emulator tests

Every API and repository test also runs against the real Firestore Admin
adapter when `FIRESTORE_EMULATOR_HOST` is set (otherwise those parametrizations
are skipped and only the in-memory repository is used). This needs JDK 21+ and
Node. From `backend/`:

```powershell
powershell -File .\scripts\run-emulator-tests.ps1
```

CI runs the same thing with `firebase emulators:exec` (see
`../.github/workflows/ci.yml`). The emulator project ID is `demo-attune-tests`;
`demo-` IDs can never reach a real Firebase project. If a failed run leaves the
emulator holding port 8080, stop the leftover `java` process before retrying.

The in-memory repository enforces Firestore's path rules (documents have an even
number of path segments, collections an odd number) so path mistakes fail in
unit tests too.

The API contract and collection model are documented in
[`../docs/api_integration.md`](../docs/api_integration.md). Tests use synthetic
claims/data. **They still do not verify live Firebase Authentication or a real
Firestore project** (only the emulator). No Firestore rules or indexes are
deployed automatically; review
[`../docs/firestore_indexes.md`](../docs/firestore_indexes.md) before a deliberate
deployment. EEG inference, webcam processing, and AI Buddy remain unavailable
without their approved artifacts/providers.
