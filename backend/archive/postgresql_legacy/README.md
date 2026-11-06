# Archived PostgreSQL implementation (inactive)

This folder preserves the original PostgreSQL/SQLAlchemy/Alembic implementation
for recovery and historical reference. Nothing under this folder is imported by
the active FastAPI application. Do not use its migrations, models, or Compose
configuration as current setup instructions.

The active backend uses Firebase Authentication and Cloud Firestore through
`backend/app/repositories/`. No database or cloud resources were dropped or
deleted as part of this archive.
