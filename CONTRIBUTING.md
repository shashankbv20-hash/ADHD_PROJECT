# Contributing

## Prerequisites

| Tool | Version | Used for |
| --- | --- | --- |
| Node.js | 22 (`frontend/.nvmrc`) | frontend, Firebase emulators |
| Python | 3.13 (`backend/.python-version`) | FastAPI backend |
| JDK | 21 or newer | Firestore emulator only |

Line endings are LF everywhere (`.gitattributes`, `.editorconfig`); Windows `.bat`/`.cmd`
files stay CRLF.

## Rules that always apply

- **Synthetic data only.** Never commit or paste real participant data.
- **No secrets.** Never put Admin SDK credentials, service-account JSON or private keys in the
  repo or in `NEXT_PUBLIC_*` variables. `.env` files are git-ignored; copy from the examples.
- Preserve participant ownership, consent gating and role restrictions. Roles come only from
  trusted Firebase custom claims.
- Firestore + Firebase Auth is the architecture ([ADR-001](docs/adr-001-firestore-first.md)).

## Frontend (`frontend/`)

```bash
cd frontend
npm ci
cp .env.example .env.local   # optional; the default demo provider needs no secrets
npm run dev                  # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright smoke tests (builds, serves on port 3100; first run: `npx playwright install chromium`) |
| `npm run build` | Production build |

## Backend (`backend/`)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

| Command | What it does |
| --- | --- |
| `ruff check app tests` / `ruff format --check app tests` | lint / format |
| `python -m pytest -q` | tests on the in-memory repository (emulator cases skip) |
| `pwsh scripts/run-emulator-tests.ps1` | full suite against Auth + Firestore emulators (needs JDK 21+) |

The same emulator run in CI uses a `demo-` project ID, which can never reach a real project.

## Rules, live e2e and the emulators

Both need Java 21+. They start their own emulators on dedicated ports (`demo-` projects only).

| Command (from `frontend/`) | What it checks |
| --- | --- |
| `npm run test:rules` | Firestore security rules (`rules-tests/`) |
| `npm run test:e2e:live` | Real browser sign-in, consent, scored run through the API, export, erase. Uses the Auth emulator and the real token path |

On Windows set `ATTUNE_PYTHON` to the backend venv's `python.exe`, and optionally
`PLAYWRIGHT_CHANNEL=msedge` to use an installed browser instead of downloading Chromium.
`E2E_SKIP_BUILD=1` reuses the last build. If a run is interrupted, a leftover emulator Java process
may keep a port: stop it before the next run.

## Contract tests

`scripts/serve_test_app.py` serves the real API with fake tokens and an in-memory store
(loopback only; requires `ATTUNE_ALLOW_FAKE_AUTH=1`). Then, from `frontend/`:

```bash
BACKEND_CONTRACT_URL=http://127.0.0.1:8765 npx vitest run src/lib/backend/contract.test.ts
```

## Assigning roles

`python scripts/set_role.py --help` sets the `role` custom claim (for example `caregiver`).

## Pull request checklist

- [ ] Lint, typecheck and tests pass locally (CI runs all of them plus a dependency audit and a container build).
- [ ] New behaviour has tests; privacy wording matches where data actually goes.
- [ ] Docs updated if an API, rule, index or setting changed.
- [ ] No secrets, no real data, no generated artifacts.
