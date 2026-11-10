# Deployment and operations runbook

Status: **a starting point, not a verified production setup.** The container and the
hardening below were checked locally (the API start command, headers, size and rate
limits, the production frontend build). A container image build, a real deployment, and
every item under "Before real participants" have **not** been done.

## Shape of the system

- **Frontend**: Next.js (`frontend/`). Static assets plus server-rendered routes; deploy to
  any Node-capable host (for example Vercel or a container). Public `NEXT_PUBLIC_*` values
  are baked in at build time, so a different provider or API URL needs a new build.
- **API**: FastAPI (`backend/`, `Dockerfile`). Stateless; stores data in Cloud Firestore and
  verifies Firebase ID tokens. Run any number of instances.
- **Identity and data**: Firebase Authentication and Cloud Firestore (ADR-001).

## Backend configuration

All via environment variables (or `backend/.env` locally; never commit it).

| Variable | Default | Purpose |
|---|---|---|
| `FIREBASE_PROJECT_ID` | none | Project used to verify tokens and reach Firestore. Required. |
| `FIRESTORE_DATABASE_ID` | `(default)` | Firestore database. |
| `ENVIRONMENT` | `development` | Set to `production` to send HSTS. |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated exact browser origins. Never `*`. |
| `LOG_LEVEL` | `INFO` | Logs never contain tokens, request bodies, trial events or message content. |
| `MAX_REQUEST_BYTES` | `262144` | Larger request bodies get 413. The biggest legitimate request is a 24-trial batch (a few KB). |
| `RATE_LIMIT_PER_MINUTE` | `240` | Per authenticated caller (hashed token). `0` disables. |
| `RATE_LIMIT_IP_PER_MINUTE` | `600` | Per client address. `0` disables. |
| `TRUST_PROXY_HEADERS` | `false` | Use `X-Forwarded-For` for the client address. Enable only behind a proxy that overwrites it. |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | (uvicorn) proxies whose forwarded headers are honoured. |

**Credentials.** Use workload identity / Application Default Credentials. Do not bake
service-account key files into images or put them in the frontend. The Firebase Web
configuration in the frontend is public by design and is not a secret.

**Health.** `GET /health/live` (process only) and `GET /health/ready` (reads Firestore; 503
when unavailable). Both are exempt from rate limiting.

## What the hardening does and does not do

- Security headers on every API and page response (`nosniff`, no framing, no referrer, no
  caching of API data, camera/microphone/geolocation denied, HSTS in production).
- Request size limit and rate limits, as above.
- The rate limiter is **in-process**: each instance counts separately, so N instances allow
  roughly N times the limit. It is a safety net against runaway clients, not a global
  control. Put a real limiter in front (for example Cloud Armor or an API gateway) before
  serious exposure.
- The frontend sets no script-restricting CSP (a nonce-based CSP needs fully dynamic
  rendering, which the app does not use) and no Cross-Origin-Opener-Policy (it would break
  Firebase popup sign-in). Revisit if the rendering model changes.
- **Not implemented:** Firebase App Check, bot protection, WAF rules, alerting.

## Dependency audit

`npm audit --omit=dev` reports 0 vulnerabilities. `@grpc/grpc-js` (pulled in by the
Firebase web SDK, which pins an old range) is forced to a patched release with an npm
`overrides` entry in `frontend/package.json`; the browser Firestore client does not load it,
and build, tests and end-to-end checks pass with the override. Remove the override when
Firebase ships a patched dependency. `npm audit` still lists moderate **dev-only** issues in
the lint toolchain (`minimatch` in `typescript-eslint`), which only process trusted source.

## Firestore rules and indexes

Rules and index definitions live in `frontend/firestore.rules` and
`frontend/firestore.indexes.json`. Deploying them is a deliberate, separate step:

```powershell
npx firebase-tools@15.34.2 deploy --only firestore:rules,firestore:indexes --project <project-id>
```

The `auditEvents` index (`subject_id` ASC, `created_at` DESC) is defined but **not
deployed**; the access log query needs it. The other composite queries listed in
`docs/firestore_indexes.md` are not yet defined in the file; the emulator does not enforce
indexes, so these are unproven against a real project until deployed and exercised.

## Assigning roles

Caregiver, clinician and researcher roles are Firebase custom claims, set only by a trusted
operator with `backend/scripts/set_role.py` (see its docstring). Users must sign in again
(or use `--revoke`) for a new role to take effect.

## Before real participants (nothing here is done)

1. **Consent**: replace the draft consent wording and version with approved text; decide the
   guardian/assent flow for children.
2. **Ethics and legal review** of what is stored (child behavioural data), retention, and
   cross-border hosting.
3. **Retention policy** and a decision about older Firebase-only records (they are not
   covered by the erasure tool).
4. Deploy and test the Firestore rules and indexes in a staging project; add automated
   rules tests.
5. Staging environment, backups/export schedule for Firestore, monitoring and alerting,
   log retention.
6. App Check and an edge rate limiter.
7. A live end-to-end test of the Firebase-mode screens against a staging project.
8. Verify the container image builds and runs on the target platform.
