# ADR-001: Firebase Authentication and Cloud Firestore

**Status:** Accepted; implemented in the FastAPI persistence layer.

## Decision and rationale

Use Firebase Authentication for account identity and Cloud Firestore as the
application persistence system. This aligns the backend with the existing
Firebase-enabled frontend, removes a second identity-to-database mapping and
relational migration service, and supports the current document-oriented
participant profile and activity-summary data. FastAPI remains the trusted
server boundary for validation, consent, authorization, scoring, analytics,
reports, and future inference. The original PostgreSQL specification is
preserved as requirements history in `backend_plan.md`; it is superseded as the
active persistence architecture.

## Responsibilities and trust

- Firebase Authentication issues identities; protected API requests carry a
  Firebase ID token in `Authorization: Bearer ...`.
- FastAPI verifies token signatures/revocation with Firebase Admin and derives
  UID and allowlisted role only from verified claims. Public request fields
  cannot assign roles or ownership.
- Firestore is accessed server-side through the Firebase Admin repository.
  Admin SDK bypasses Firestore Rules, so every private API operation performs
  explicit participant ownership, caregiver relationship, role, and current
  consent checks in FastAPI. Important writes use Firestore transactions.
- The existing `frontend/firestore.rules` remains unchanged and restrictive for
  browser SDK access. No rules were deployed or weakened for this decision.

## Firestore document layout

Paths are stable and scoped by UID or subject ID; all timestamps are UTC
Firestore timestamps. The API generates UUID document IDs unless a natural,
retry-stable key is more suitable.

| Path | Contents / access pattern |
|---|---|
| `users/{uid}` | Existing frontend-compatible profile. Exact current fields: `uid`, `displayName`, fixed `role: participant`, `cloudSyncEnabled`, `createdAt`, `updatedAt`. Backend provisioning preserves this shape. |
| `backendUsers/{uid}` | Server-managed projection of verified role claim and account metadata; never writable/readable through the browser rules. |
| `subjects/{subjectId}` | Subject owner UID, display label, active state, created timestamp. |
| `subjects/{subjectId}/caregiverRelationships/{relationshipId}` | Caregiver UID, grant actor, active/revoked state and timestamps. |
| `caregiverSubjectIndex/{caregiverUid}/subjects/{subjectId}` | Transactionally maintained reverse lookup projection for caregiver listing/session authorization; the nested relationship above remains the authorization source. |
| `subjects/{subjectId}/consents/{consentId}` | Scope, version, actor UID, idempotency key, grant/withdrawal status and timestamps. |
| `subjects/{subjectId}/consentScopes/{scope}` | Transactionally updated current-consent pointer. Collection transactions read/write this shared scope document so a withdrawal serializes with new collection. |
| `activities/{activityCode}` and `activities/{activityCode}/configurations/{version}` | Versioned catalog and CPT configuration. Seed is create-if-missing and does not overwrite existing operator data. |
| `subjects/{subjectId}/sessions/{sessionId}` | Owner UID, lifecycle, idempotency fingerprint and timestamps. |
| `subjects/{subjectId}/sessions/{sessionId}/activities/{assignmentId}` | Activity mode/status and immutable configuration snapshot. |
| `.../activities/{assignmentId}/events/{trialIndex}` | One deterministic, retry-safe event document per trial; no event stream is embedded in a growing session document. |
| `subjects/{subjectId}/sessions/{sessionId}/feelingCheckIns/{pre\|post}` | Consent-gated check-in document with actor and recorded time. |
| `subjects/{subjectId}/activitySummaries/{assignmentId}` | Server-calculated summary, provenance, calculation version and source IDs. |
| `subjects/{subjectId}/digitalTwin/current` and `subjects/{subjectId}/digitalTwinHistory/{historyId}` | Current derived profile and immutable versioned snapshots/source summary IDs. History is a sibling collection: `digitalTwin/history/{id}` would be an invalid (odd-length) Firestore document path. |
| `subjects/{subjectId}/reports/{reportId}` | Idempotent report metadata and derived content. |
| `subjects/{subjectId}/reportIdempotency/{keyHash}` | Stable retry-key claim and fingerprint for report creation. |
| `subjects/{subjectId}/webcamFeatureRecords/{recordId}` | Planned compact derived features only; no raw webcam video. |
| `subjects/{subjectId}/eegRecordings/{recordingId}` and `.../predictions/{predictionId}` | Planned metadata and results only. Raw EEG belongs in private object storage, not Firestore. |
| `auditEvents/{eventId}` | Minimal actor/action/resource metadata; no tokens, raw events, message content, EEG or video. |
| `sessionIdempotency/{hashedUidAndKey}` | Stable mapping from a user-scoped create retry key to the session; raw client key is not used as a document path. |

Backend session, event, summary, report, and Twin records are not mirrored into
`users/{uid}/appSessions`, `activityRuns`, `reports`, or
`digitalTwin/current`. Those are existing frontend-owned legacy/demo paths and
remain untouched. When frontend API mode is deliberately enabled, the same
authoritative result must be written through FastAPI only; no client-side
Firestore save for that API-owned operation.

## Authorization and current frontend data

The frontend continues to use Firebase Web Auth and its current owner-scoped
Firestore behavior until a deliberate API cutover. Existing records are
preserved in place; this implementation does not migrate, delete, or copy them.
The API uses the shared `/users/{uid}` profile shape and subject-scoped backend
collections. Participant-owned legacy CPT cloud sync remains a frontend-owned
operation; backend session creation, event intake/scoring, consent, check-ins,
analytics, reports, and Twin versions are server-authoritative API operations.
The current frontend is not yet connected to those API routes.

Only verified `participant`/`child`, `caregiver`, `clinician`, and `researcher`
claims are recognized; unknown claims fail closed. Caregivers require an
explicit active subject relationship. Clinician/researcher access remains
denied until assignment policy is specified. Research-data operations require
current research consent; withdrawal is transactionally checked with collection
writes. Pause and cancel remain stop controls.

## Firestore limits and indexes

Firestore provides no relational joins, foreign keys, or SQL-style ad-hoc
analytics. Data is modeled around subject-scoped access; histories and summary
aggregation are bounded/paginated. Transactions have document/read/write and
size limits, so raw EEG payloads and video are excluded. Composite indexes may be
required for owner/status plus timestamp queries and consent/relationship
filters. Index requirements are documented in `docs/firestore_indexes.md`; rules
or indexes are not deployed automatically.

## Verification status

The in-memory repository-backed suite passes 18 tests. No Firestore Emulator
Suite tests or live Firebase Authentication/Firestore reads or writes were run.
The API code therefore has unit/API contract evidence, not live cloud evidence.
