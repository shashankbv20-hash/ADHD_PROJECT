# API Integration Readiness

## Status and boundary

This document describes frontend custom-API preparation and remaining client
integration work. A versioned FastAPI API is implemented in `../../backend/`, with
its current routes documented in `../../docs/api_integration.md`. The frontend
types in `src/types/api.ts` remain logical proposals and are not all equivalent
to the backend wire schemas. Repository history records the local Firestore
rules as previously deployed to `adhd-bf37a`; this task did not recheck the live
release. Authenticated browser read/write tests remain outstanding.

No generic API-client request is wired to the backend. The frontend client does
not yet attach Firebase ID tokens, and service adapters still use the existing
Firebase/demo providers. Firebase mode continues to use the Firebase Web SDK for
Auth and Firestore.

## Current frontend data flow

- Server pages call the service facades in `src/lib/services/`.
- Demo adapters under `src/lib/services/demo/` read fixtures in
  `src/data/demo/` for participant, clinician, activity-definition, and
  researcher views.
- Firebase participant data is handled through `src/lib/firebase/` and the
  Firebase account provider, separate from the generic remote API client.
- `DemoSessionProvider` stores upload metadata and simulated processing stages
  in browser memory. It never reads or uploads file contents.
- `ActivitySessionProvider` stores CPT events and calculated run summaries in
  browser memory. `buildCptRunSummary`, progress, comparison, and Digital Twin
  calculations remain frontend-owned; there is no duplicate store or server
  scoring path.
- The clinician EEG visualization is a separate illustrative fixture, not a
  participant-linked session result.
- Some presentation components still import demo-only identity/notice constants
  directly: participant upload/session/activity pages and detail/history views,
  CPT progress/run views, Digital Twin, and clinician CPT context components.
  `ClinicianEegView` directly imports the intentionally unlinked EEG illustration.
  These remain protected by the workspace provider gate; they should move to
  adapter-provided props only when matching backend fields/contracts are agreed.
- The public `apiRequest` helper existed before this milestone but had no
  application endpoint calls. It is now a centralized JSON-only client.

## Provider selection

Configuration is parsed centrally in `src/lib/config/frontend-config.ts` and
service selection is centralized in `src/lib/services/service-provider.ts`.
Existing service imports keep their names, while their facade selects a demo
adapter, Firebase participant adapter, or explicit remote placeholder.

| Provider | Behavior |
| --- | --- |
| `demo` (default) | Existing synthetic fixtures and in-memory workflows remain available with their current demo labels. |
| `remote` without a base URL | Workspace displays an explicit not-configured state. No demo data is rendered as a fallback. |
| `remote` with a base URL | Workspace displays an endpoint-contract-unconfirmed state. No request is sent and no demo data is substituted. |
| `firebase` with Web App configuration | Uses Firebase Auth and user-owned Firestore data for the participant provider; no custom backend routes or staff access are used. |
| `firebase` without Web App configuration | Configuration is rejected and the workspace shows an unavailable state; it does not fall back to demo records. |
| Invalid configuration | Workspace displays the configuration error and does not select the demo provider. |

The app workspace gate prevents demo stores from mounting in remote mode. The
Firebase participant gate requires Auth and profile initialization, mounts the
participant-owned CPT store, and blocks clinician/researcher routes. Public
values are embedded by Next.js at build time; changing provider mode requires a
new build/deployment.

## Environment configuration

`.env.example` contains placeholders only:

| Variable | Purpose | Default / validation |
| --- | --- | --- |
| `NEXT_PUBLIC_DATA_PROVIDER` | Selects `demo`, `remote`, or `firebase`. | Defaults to `demo`; other values are rejected. |
| `NEXT_PUBLIC_API_BASE_URL` | Public base URL reserved for a future custom backend. | Used only in remote mode; must be absolute HTTP(S), without credentials, query, or fragment. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web App configuration. | Required in Firebase mode; public client configuration, not a secret. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Web App configuration. | Required in Firebase mode. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Web App configuration. | Required in Firebase mode and must match the confirmed project. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web App configuration. | Required in Firebase mode. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Web App configuration. | Required in Firebase mode by this frontend configuration. |

All `NEXT_PUBLIC_*` values are public and must never contain credentials,
tokens, or secrets. The example `http://localhost:8000` is only a local-development placeholder;
there is no server at that address in this project. `.env.example` is the only
environment file intended for source control; real `.env*` files remain ignored.

## API client and errors

`src/lib/api-client.ts` exports the injectable `createApiClient` factory and
typed errors; `src/lib/api-client-runtime.ts` exports the configured `apiClient`,
`apiRequest`, and configuration check. The client supports relative paths, standard
HTTP methods, headers, JSON request bodies, JSON responses, and `AbortSignal`
cancellation. An injected `fetcher` can be provided to `createApiClient` for
future unit tests.

The client deliberately does not implement file/multipart upload, automatic
timeouts, retries, caching, token handling, endpoint routes, or request-body
logging. It does not include response bodies in HTTP error messages. Errors are
classified as configuration, not-configured, contract-unconfirmed, unsupported,
network, HTTP, invalid-response, invalid-request, or cancelled. `ApiErrorNotice`
maps those errors to user-safe copy; retry is always an explicit user action.
The workspace error boundary logs only the error name and framework digest, not
the error object or any request payload.

`ProposedApiErrorBody` in `src/types/api.ts` is an example for backend discussion
only. The backend currently returns a safe error envelope documented in
`../../docs/api_integration.md`; the frontend does not parse or map that envelope
yet.

Firebase Authentication and Firestore use a separate modular SDK integration,
not the generic JSON API client. Its project configuration is kept under
`frontend/`; no Firestore rules were changed or deployed in this task. See
`frontend/docs/FIREBASE_SETUP.md` for scope and remaining live-test steps.

## Proposed logical contracts

`ResearchApiContracts` in `src/types/api.ts` records frontend request/response
needs without assigning endpoint URLs or HTTP methods. It reuses existing
participant, clinician, EEG session, activity, CPT, Digital Twin, and research
domain types where practical. Optional fields represent data that the existing
UI may not have; `null` remains distinct from an omitted field. The proposals
cover:

- Participant profile/summary and recent sessions.
- Clinician roster and participant detail.
- Session creation metadata, upload metadata/acceptance, analysis status, and
  optional result measurements/provenance.
- Activity definitions, CPT run submission/history, and source runs from which
  current progress and Digital Twin summaries can be derived.
- Research model/evaluation metadata, experiments, datasets, and explainability
  metadata/feature-importance output.

DTOs do not assert that frontend status vocabularies, UI-only fields, dates,
nullability, aggregation, or data ownership match a future server. A remote
adapter must map confirmed backend DTOs to existing presentation types and must
not label server data as demo or infer missing measurements.

## Existing versus proposed integration

| Area | Existing frontend behavior | Proposed requirement awaiting confirmation |
| --- | --- | --- |
| Participant | One synthetic profile/dashboard and fixture sessions. | Authorized participant identity, profile/summary/session reads, nullability, pagination, and ownership rules. |
| Clinician | Synthetic roster and review queue; participant details are roster records. | Clinician authorization, roster/detail fields, review-state ownership, and participant-to-session linkage. |
| Sessions and EEG | Client metadata checks followed by in-memory session creation and manual simulated stages. | Session lifecycle, upload handoff, processing states, result/provenance fields, and cancellation semantics. |
| CPT/activity | Definitions are fixtures; trial scoring and run summaries are calculated locally and held in memory. | Whether runs are submitted, event schema/versioning, history retention, and whether server-calculated metrics are authoritative. |
| Progress/Digital Twin | Derived from in-memory scored CPT runs using shared frontend helpers. | Source data, calculation ownership/versioning, history retention, and provenance. No model inference is implied. |
| Research | Synthetic model, experiment, dataset, and explainability fixtures. | Access permissions, schema/versioning, metric provenance, dataset metadata rights, experiment execution/results, and explanation provenance. |

FastAPI endpoint paths, methods, request/response schemas, and safe error
envelope are now documented in `../../docs/api_integration.md`, but have not
been aligned with these proposed frontend DTOs or called by an application page.

## EEG upload requirements for backend specification

Current demo validation accepts `.csv`, `.edf`, and `.bdf` extensions up to
25 MB, rejects empty files, and requires a local consent acknowledgement. These
checks examine browser file metadata only; extension validation does not prove a
recording is valid. The existing demo form never reads or sends the file.

Before implementing remote upload, the backend contract must specify:

1. Supported formats, format variants, maximum size, and any duration/channel
   constraints.
2. Which client-side checks are hints and which server-side content, malware,
   and structural validations are authoritative.
3. Required acquisition metadata, protocol vocabulary, consent evidence, and
   participant/session association; authenticated identity should not be trusted
   from a client-supplied ID without authorization rules.
4. Whether session creation precedes upload and whether transport is direct
   multipart, a server-mediated stream, or a short-lived signed upload. No
   transport is selected here.
5. Session-creation and upload-acceptance response fields, idempotency,
   cancellation, partial upload cleanup, and safe retry behavior.
6. Processing state names, polling/event semantics, terminal failure handling,
   result availability, timestamps/time zones, and provenance/version metadata.
7. Storage region/retention, access controls, deletion, audit, encryption, and
   handling of potentially identifying EEG metadata.

The frontend must keep its current simulated upload independent until those
decisions are documented and reviewed. Client validation must not replace
server-side validation.

## Error and state conventions

- A successful empty collection is an empty result, not an error.
- A missing individual record remains `null`/not-found where the service
  contract allows it; it must not be converted to an empty object.
- Configuration and unconfirmed-contract states are unavailable, not successful
  empty results.
- Network and non-success HTTP responses are typed failures; no demo fallback
  occurs after a remote failure.
- Invalid JSON/content type is an invalid-response failure.
- Aborted requests are classified as cancelled and are not automatically
  retried.
- Loading skeletons, route error boundaries, `Alert`, `EmptyState`, and
  `ApiErrorNotice` are shared UI patterns. API error text must not expose raw
  response bodies, EEG contents, tokens, or stack traces.

## Security and privacy considerations

- `NEXT_PUBLIC_*` values are public and build-time embedded. They may contain
  only a base URL/provider mode, never a secret.
- No credentials, authorization headers, token refresh, or authentication flow
  are implemented. Those require an approved auth design.
- The JSON client does not accept file content or multipart bodies. EEG upload
  requires a separately reviewed client/transport design after a verified
  contract exists.
- Do not log request bodies, EEG file names unless necessary, signal data,
  participant data, raw response bodies, or token values.
- Backend authorization, retention, encryption, audit, and breach-response
  policies remain backend/security decisions.

## Integration sequence and blockers

1. Review the current versioned Firestore-backed API/request/response/error/
   authentication contract in `../../docs/api_integration.md` and align it with
   product needs.
2. Confirm ownership, authorization, consent, data retention, and privacy
   requirements with product/security stakeholders.
3. Reconcile proposed DTOs with the backend schema and write explicit mapping
   functions; add contract tests against an agreed fixture/specification.
4. Implement one remote service adapter at a time using `apiClient`; preserve
   the demo adapter and make provider selection explicit per deployment.
5. Add request-specific loading, empty, error, cancellation, and retry behavior;
   do not substitute fixtures on a remote error.
6. Integrate EEG upload only after file validation and transport responsibilities
   are agreed and tested.
7. Add authenticated end-to-end verification only when a backend environment is
   available.

Current custom-API blockers are frontend adapter/token integration, a deliberate
direct-Firestore-to-API ownership cutover for each operation, live Firebase
verification, and unresolved EEG upload transport/model requirements. The
backend uses Firestore; no PostgreSQL migration/cutover is planned. Firebase has
a separate source integration targeting `adhd-bf37a`; authenticated browser
profile/persistence smoke tests remain outstanding. No Firestore Emulator Suite
or live backend Firebase Auth/Firestore verification was performed.
