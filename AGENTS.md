# Workspace instructions

- Keep the existing Next.js application in `frontend/`; do not recreate or
  replace it.
- Before editing frontend code, read `frontend/AGENTS.md` and the relevant
  Next.js documentation under `frontend/node_modules/next/dist/docs/`.
- Read `backend_plan.md` before backend work. Implement its phases in order and
  do not add backend features during repository-only tasks.
- Keep Firebase Web configuration under `frontend/`; never place Admin SDK
  credentials or service-account secrets in frontend code or public variables.
- Firebase Authentication and Cloud Firestore are the active backend identity
  and persistence architecture per `docs/adr-001-firestore-first.md`. The
  original PostgreSQL plan is preserved as history; do not restore it or create
  duplicate authoritative writes without a new explicit architecture decision.
- Use synthetic data only for development; preserve participant ownership,
  consent, and role restrictions.
