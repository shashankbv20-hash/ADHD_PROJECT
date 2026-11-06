# Attune Frontend Architecture

## 1. Purpose

Attune is a frontend-only research prototype for an ADHD Digital Twin and EEG
analysis platform. It is designed for interface review and future integration
with a backend, not for diagnosis or treatment.

This document describes the implemented Milestone 1 foundation, the Milestone 2
participant upload-to-review journey, the Milestone 3 cognitive activity library
with one interactive CPT, the Milestone 4 activity history and progress views,
the Milestone 5 research Digital Twin profile, the Milestone 6 clinician roster
and participant overview, the Milestone 7 advanced clinician features, and the
Milestone 8 researcher portal, Milestone 9 API readiness, and final frontend QA.
Firebase mode contains participant Auth and Firestore integration. The Web App
configuration and rules deployment are verified for `adhd-bf37a`; live
profile/persistence browser tests remain outstanding. The application does not
claim EEG processing, clinical validation, staff data access, experiment
execution, or model inference.

## 2. Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16.4.3, App Router |
| UI runtime | React 19.3 |
| Language | TypeScript, strict mode |
| Styling | Tailwind CSS 4 with CSS theme tokens |
| Icons | Lucide React |
| Charts | Recharts 3 |
| Firebase | Modular Firebase Web SDK 11.10.0 for optional participant Auth/Firestore provider |
| Package manager | npm |

Cache Components and Partial Prefetching are enabled in `next.config.ts`, which
matches the current Next.js scaffold defaults. Pages that only render local demo
fixtures are prerendered as static content.

## 3. Directory Structure

```text
src/
  app/
    (app)/                 Authenticated-style workspace shell
      participant/         Dashboard, upload, processing, session records
        activities/        Activity library, interactive CPT, run history
        progress/          CPT aggregate metrics and multi-run trends
        digital-twin/      Research profile and modality/data-quality states
      clinician/           Dashboard, roster, participant overview, EEG availability,
                           behavioral summary, comparison, and research report
      research/            Research dashboard, model comparison, experiment
                           inventory/detail, dataset inventory, explainability
      loading.tsx          Route-level loading skeleton
      error.tsx            Route-level error boundary
    (auth)/                Split-screen auth layout
      login/
      register/
    page.tsx               Public landing page
    layout.tsx             Root layout, fonts, metadata
    globals.css            Design tokens, base styles, utilities
  components/
    ui/                    Button, Card, Badge, Input, Alert, Progress, etc.
    layout/                Site header/footer, app shell, logo, page header
    charts/                Recharts wrappers and synthetic EEG waveform
    feedback/              Demo-data, provider-unavailable, and API-error notices
  features/
    auth/                  Login/register forms and local validation
    sessions/              Session table, filters, detail view, status badges
    upload/                Demo upload form, in-memory store, processing views
    activities/            Activity library, in-memory run store, CPT engine
    digital-twin/          Synthetic profile summary
    clinician/             Roster search, participant overview, EEG availability,
                           behavioral summary, comparison, and report helpers
    research/              Dashboard, model comparison, experiment inventory and
                           detail, dataset inventory, and explainability views
  data/demo/               Clearly separated synthetic fixtures, including the
                           unlinked illustrative EEG preview
  lib/
    api-client.ts          Injectable JSON client and typed transport errors
    api-client-runtime.ts  Environment-configured client and compatibility helper
    config/                Central demo/remote/Firebase provider configuration
    firebase/              Firebase Web initialization and participant data services
    utils.ts               Formatting and class-name helpers
    services/              Provider facades, demo adapters, remote placeholders
  types/
    index.ts               Shared UI/domain types
    api.ts                 Proposed frontend API DTOs and logical contracts
docs/
  API_INTEGRATION_READINESS.md
  FRONTEND_ARCHITECTURE.md
  FRONTEND_ROADMAP.md
```

This tree is relative to `frontend/`; shared architecture and backend progress
documents live in the repository-root `docs/` directory.

The structure is intentionally smaller than the long-term product map. Folders
are created only when they contain working code.

## 4. Rendering Model

- Pages and layouts are Server Components by default.
- Interactivity is isolated to client components: navigation shell, auth forms,
  session filters, and chart wrappers.
- Domain fixture records are read through typed service modules. A small number
  of demo-only identity/notice constants and isolated illustration fixtures are
  still imported directly by UI components; those views render only in demo
  mode behind the workspace provider gate.
- Milestone 1 routes are prerendered as static content. The dynamic demo session
  routes read `params` inside a Suspense boundary and set `instant = false` on
  the workspace layout because the shell uses `usePathname()`.
- Demo upload metadata and processing progress live in an in-memory React
  context provider. A full reload resets the demo session state.
- CPT trial timing, practice feedback, and scoring run entirely on the client.
  Completed scored runs live in a separate in-memory activity provider. A full
  reload clears all runs.
- Activity history and progress are client views over that same provider. The
  run-detail route awaits `params` inside a Suspense boundary and recovers with
  an explicit missing-record state when a run is no longer in memory.
- The Digital Twin profile is a client view over the same in-memory activity
  provider. It reuses the progress summary helper so its metrics cannot diverge
  from the progress page.
- Clinician behavioral summaries, session comparison, and the research report
  are client views over the same activity provider. They reuse the shared CPT
  progress and Digital Twin helpers rather than recalculating metrics.
- Clinician participant subroutes await `params` inside a Suspense boundary and
  set `instant = false`, matching the existing participant overview route.
- The research report print action calls `window.print()`. Print styles hide the
  workspace navigation, header, footer, and screen-only actions; no report file
  is generated or stored.
- Researcher dashboard, model, dataset, and explainability views are server
  components over the typed research service. Experiment inventory and dataset
  inventory add client-side search/filter controls over server-provided fixture
  data.
- The research experiment detail route awaits `params` inside a Suspense
  boundary, sets `instant = false`, and renders an explicit not-found state for
  unknown synthetic experiment IDs.
- `loading.tsx` and `error.tsx` provide explicit route states without pretending
  that a network request is occurring.

## 5. Design System

Design tokens live in `src/app/globals.css` under Tailwind's `@theme` block:

- Ink navy for primary text and the sidebar.
- Restrained teal for primary actions and data accents.
- Violet for research/explainability accents.
- Amber for demonstration-data notices.
- Cool canvas and white surfaces with consistent border and shadow tokens.

Shared components include:

- `Button` with semantic variants, including inverse variants for dark panels.
- `Card` composition primitives with `min-w-0` for responsive grid safety.
- `Badge`, `Alert`, `Progress`, `Skeleton`, `EmptyState`, and `InfoTooltip`.
- `StatCard` for metric summaries with an explicit demo marker.
- `PageHeader` for consistent page hierarchy.

Typography uses Geist Sans and Geist Mono. Data values use the mono face for
alignment and scannability. Focus-visible outlines and a skip link are global.
Reduced-motion preferences are respected.

## 6. Data and Service Layer

```text
Server Component
    -> typed service (src/lib/services/*)
        -> centralized provider selector (demo | remote | firebase)
            -> demo adapter -> fixture (src/data/demo/*) and existing stores
            -> remote adapter -> confirmed API client contracts (future)
            -> Firebase Web adapter -> authenticated participant-owned documents
    -> presentation components
```

Contracts:

- `ParticipantService.getDashboard(participantId)`
- `ParticipantService.listSessions(participantId)`
- `ActivityService.listActivities()`
- `ActivityService.getActivity(activityId)`
- `ClinicianService.getOverview()`
- `ClinicianService.getParticipant(participantId)`
- `ResearchService.getOverview()`
- `ResearchService.getExperiment(experimentId)`

The service entry points in `src/lib/services/*.ts` select the demonstration
adapter by default, a remote placeholder in `remote` mode, or a Firebase
participant adapter in `firebase` mode. Demo adapters in
`src/lib/services/demo/` retain the existing fixture behavior. Remote
placeholders return typed `ApiClientError` instances until endpoint and response
contracts are confirmed; they never substitute fixture data. Firebase Auth and
Firestore use the modular Web SDK only when Firebase mode and all public Web App
settings are configured. The workspace gate hides demo-backed records in remote
mode and exposes only the authenticated participant workspace in Firebase mode.
All `NEXT_PUBLIC_*` configuration is public and build-time embedded; it must
not contain secrets.

The demo participant upload flow uses `DemoSessionProvider` and typed
`DemoUploadSession` records. It stores file metadata, consent timestamp, and
simulated stage progress in memory only; file contents are never read.

Firebase mode leaves EEG upload unavailable and stores no EEG session or file.
Its `appSessions` documents describe completed CPT application workflows only.
Firebase Auth creates or validates `users/{uid}` with a fixed participant role.
The `cloudSyncEnabled` preference defaults to false and gates new CPT summary,
application-session, report-summary, and Digital Twin snapshot writes. Saved
activity records omit trial events and response timelines. Turning sync off
blocks future writes but does not delete previously stored documents.

The activity library is driven by `ActivityService` and typed
`CognitiveActivityDefinition` fixtures. The CPT uses a deterministic stimulus
sequence, creates `CptTrialEvent` records, and calculates `CptMetrics` in the
browser. In demo mode `ActivitySessionProvider` retains scored
`CptRunSummary` records in memory. Firebase mode initializes that same provider
with only the signed-in user's saved CPT summary records and associates new runs
with that user's UID. The shared progress and Digital Twin helpers calculate
from full event logs when available and aggregate stored per-run summaries when
trial logs were intentionally omitted. Clinician activity linkage remains
demo-only. EEG-derived features, model inference, webcam, and external APIs
remain unavailable.

The clinician dashboard derives participant, review-queue, and session-summary
counts from the synthetic roster and review-queue fixtures rather than storing
duplicate stat values. The roster supports client-side search and a roster-status
filter. Participant overviews reuse the same fixture IDs and filter linked CPT
runs by `participantId`; only the demo participant has a linked in-memory
activity record. Session-level clinician history remains explicitly unavailable
because the frontend model does not associate session records with clinician
participant IDs.

Clinician participant subroutes share a participant navigation component for
overview, EEG, behavior, and report. The EEG view checks for linked recordings
and shows explicit unavailable states for raw signal, recording metadata, quality
assessment, frequency-band analysis, preprocessing, and model inference. Its
waveform and band-power preview come from `src/data/demo/eeg-illustration.ts`,
which is labelled as a separate synthetic fixture and never associated with a
participant.

Behavioral summaries aggregate linked scored CPT runs and expose run-level
metrics, task configuration, completeness, observation window, and descriptive
first-versus-latest differences. Session comparison filters to scored CPT runs
with a participant ID, a complete trial log, and a calculated accuracy value. It
requires two different eligible runs from the same participant and reports
arithmetic differences only when both sessions contain the relevant value. The
research report assembles participant context, CPT metrics, trend data, Digital
Twin availability, and missing-data limitations in the browser. It does not add
a report timestamp, persistence layer, or clinical interpretation.

The research portal is a read-only view over `src/data/demo/research.ts`.
Dashboard totals are derived from fixture arrays rather than stored duplicate
stat values. Model comparison labels metric values as illustrative and leaves
precision/recall unavailable; confusion matrices, ROC curves, and
precision-recall curves are explicitly unavailable because no prediction-level
data exists. Experiment records are planning fixtures with `executionStatus:
"not-run"` and `resultsAvailable: false`; the detail route resolves dataset and
model references from the same fixture. Dataset records are metadata-only with
`localFileVerified: false`, and no count is estimated when the fixture provides
null. Explainability uses a synthetic feature-importance fixture; channel,
frequency, temporal, causal, and clinical explanations are unavailable. No
researcher view creates, edits, executes, exports, or persists research records.

The demo service adapters return synthetic fixtures only. Unknown
participant-workspace IDs throw `ServiceUnavailableError`, while the clinician
service returns `null` for an unknown roster ID so the participant overview can
render a not-found state. `src/types/api.ts` contains frontend logical contract
proposals derived from existing domain types; it intentionally defines no URL,
HTTP method, or verified backend envelope. `api-client.ts` provides a reusable
JSON-only client with injected-fetch support, cancellation, safe HTTP/network/
invalid-response errors, and no automatic retries, timeouts, caching, binary
upload, or response-body logging. `ApiErrorNotice` maps typed client errors to
safe UI copy. Firebase Firestore adapters validate supported summary shapes,
scope paths to the Firebase Auth UID, and never store raw trial events. The
optional report save action writes only a summary after an explicit user action.

All demo fixtures carry a `DemoMeta` object with `isDemo: true`, a note, and a
snapshot date. UI surfaces repeat that label so a viewer cannot mistake fixtures
for real records.

## 7. UI State Coverage

| State | Implementation |
| --- | --- |
| Loading | `app/(app)/loading.tsx` skeleton |
| Empty | `EmptyState` in session tables, activities, filtered history, progress, and Digital Twin |
| Validation failure | Local auth and demo-upload validation with `aria-invalid` and error text |
| Service failure | `app/(app)/error.tsx` boundary |
| Remote provider unavailable | Workspace-level gate explains missing configuration or unconfirmed contracts without showing demo data |
| API request failure | `ApiErrorNotice` maps typed configuration, network, HTTP, invalid-response, and cancellation errors to safe copy |
| Simulated processing | Manual demo timeline with explicit simulated labels |
| Missing demo session | In-memory reset/cancel state with links back to upload |
| Activity planned state | Non-interactive "Coming soon" cards for five planned activities |
| CPT practice feedback | Per-trial outcome feedback with a manual continue action |
| CPT paused | Pause overlay that restarts the current trial on resume |
| CPT summary | Separate calculated metrics and trial-by-trial event table |
| Activity history | Newest-first in-memory run list with empty and clear states |
| Missing activity run | Reload/clear recovery state with links back to history and CPT |
| Progress | Aggregate scored-run metrics; single-run trend empty state |
| Digital Twin | Profile metrics from scored CPT runs; no-data and insufficient-trend states |
| Digital Twin modalities | Available, demo-metadata-only, and not-connected source states |
| Clinician roster | Client-side search, status filter, empty roster, and no-search-results states |
| Clinician participant overview | Linked activity metrics, unknown-ID state, and explicit unavailable session/EEG/model states |
| Clinician EEG | No linked recording, explicit unavailable analysis states, and a separately labelled synthetic preview |
| Clinician behavioral summary | Linked CPT metrics, no-run state, incomplete-log state, and insufficient-trend state |
| Clinician session comparison | Eligible-run filtering, same-participant validation, insufficient-run state, and missing-value states |
| Clinician research report | Printable report with available CPT data, no-run state, and explicit missing-data limitations |
| Research dashboard | Derived fixture counts, availability states, and links to all research views |
| Model comparison | Illustrative metric labels, unavailable precision/recall, and unavailable evaluation visualizations |
| Research experiments | Search, lifecycle filter, no-results state, plan detail, and unknown-ID state |
| Dataset inventory | Search, availability filter, no-results state, metadata-only labels, and unverified local-file state |
| Explainability | Illustrative feature-importance chart, unavailable attribution outputs, and limitation notices |
| Unsupported capability | Explicit alerts on auth, upload, session record, clinician, and research pages |
| Unavailable data | Service exceptions and "not connected" notices |
| Demo data | Amber `DemoNotice` and inline "demo" labels |

## 8. Accessibility

- Semantic landmarks, headings, tables with captions, and form labels.
- Visible focus states and a keyboard skip link.
- Mobile navigation drawer with Escape handling, focus trap, and focus return.
- Filter controls expose `aria-pressed`; result counts use `aria-live`.
- Charts include captions and accessible labels; decorative graphics are hidden.
- The CPT supports Space to respond and Escape to pause, with visible focus
  management, an `aria-live` trial announcement, and pointer controls.
- Activity history uses semantic articles and definition lists; progress charts
  include captions and accessible Recharts layers.
- The Digital Twin profile uses definition lists for metrics, text labels for
  modality states, and the same accessible trend charts as progress.
- Clinician subroutes use labelled navigation, definition lists, captioned
  tables, and explicit text states for unavailable data.
- Session comparison uses labelled selects and a captioned comparison table;
  differences are expressed in text rather than color alone.
- The research report uses semantic sections and a print stylesheet that hides
  screen-only navigation and actions.
- Status badges pair color with text.
- Layout is responsive at mobile, tablet, and desktop widths.

## 9. Security and Privacy Boundaries

- No passwords, EEG files, or participant records are stored in browser
  storage.
- Demo uploads inspect only file name, extension, and size. File contents are
  never read, uploaded, or stored.
- Demo upload metadata lives in memory and resets on reload.
- In demo mode CPT trial events and summaries live in memory and reset on reload.
  In Firebase mode scored CPT summaries are loaded from and optionally written
  to the authenticated participant's Firestore path; raw events remain in
  memory only. These remain descriptive demo-task metrics, not clinical scores.
- Activity history and progress reuse the same shared CPT calculations. Firebase
  summary-only records aggregate stored per-run metrics without reconstructing
  or inventing trial events.
- The Digital Twin profile remains descriptive and uses the shared CPT summary
  helper. Firebase mode may persist a versioned summary snapshot and source run
  identifiers when cloud sync is enabled; it adds no EEG storage, model
  inference, webcam access, or clinical interpretation.
- Clinician behavioral summaries, comparison, and reports read the same
  in-memory CPT records and add no persistence or external calls. Comparison is
  restricted to same-participant eligible runs, and no cross-participant values
  are displayed.
- The clinician EEG page adds no recording upload, signal processing, or model
  inference. Its preview fixture is not participant-linked and is not a
  measurement.
- The clinician research report is not persisted or uploaded. Browser printing
  uses available demo data. Firebase participant report summaries are a
  separate, explicitly saved CPT-summary document without trial events.
- Research views read only the local synthetic research fixture. No dataset
  file, model artifact, experiment runner, result store, or explanation service
  is accessed.
- Research dataset metadata is not written to browser storage. No dataset file
  is uploaded, downloaded, read, or validated.
- Research model metrics and feature-importance values are labelled
  illustrative and are not presented as validated results or computed
  explanations.
- In demo mode auth forms validate locally and create no account. Firebase mode
  delegates credentials and browser authentication persistence to Firebase
  Auth; passwords and ID tokens are not written by application code to
  Firestore.
- Firebase mode accesses only the Firebase Auth and Firestore Web SDK services
  when configured. No custom backend endpoint is called. Firestore Rules are
  deployed to `adhd-bf37a` and the active release matches the local rules source;
  authenticated browser read/write verification remains outstanding.
- No secrets are present in the repository.
- The platform is labelled as a research prototype and not a medical device.

## 10. Deferred Integration Work

Future integration must define:

1. Authentication and session contracts, including role authorization.
2. Upload, validation, and processing-status APIs.
3. EEG signal, recording metadata, quality, and feature data contracts.
4. Session detail, comparison, print, and export contracts.
5. Cognitive activity definitions, CPT event ingestion, and activity-history
   contracts, including explicit non-clinical labeling.
6. Digital Twin profile persistence, modality ingestion, and longitudinal
   progress contracts.
7. Clinician roster, review, report, and authorization contracts.
8. Backend contracts for research datasets, experiment execution and results,
   model evaluation, explainability, and provenance.

Adapters should replace demo services without changing page-level presentation
components. Backend failures must map to the existing explicit UI states.
