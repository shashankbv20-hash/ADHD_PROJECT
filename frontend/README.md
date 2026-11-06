# Attune — ADHD EEG Research Workspace

A frontend research prototype for an ADHD Digital Twin and EEG analysis
platform. Built with Next.js App Router, React, TypeScript, Tailwind CSS 4,
Lucide icons, and Recharts.

**Attune is not a diagnostic or treatment device.** All records, metrics, and
signals in the demo workspaces are synthetic. No real EEG processing or model
inference is connected. Firebase participant authentication and optional
Firestore persistence are configured for project `adhd-bf37a`; restrictive
Firestore rules are deployed. Live participant-profile and persistence smoke
tests remain to be completed in a browser.

## Quick Start

Run these commands from the `frontend/` directory:

```bash
npm ci
npm run dev
```

Open http://localhost:3000.

The frontend defaults to labelled demo mode and does not need an environment
file. `.env.example` documents optional provider settings. The remote API mode
remains gated because no endpoint contract is verified. Firebase mode uses the
Firebase Web SDK when configured; see [Firebase setup](docs/FIREBASE_SETUP.md).

## Scripts

```bash
npm run dev        # Start the development server
npm run build      # Create a production build
npm run start      # Start the production server
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript without emitting files
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Public landing page and research-purpose overview |
| `/login` | Demo sign-in scaffold or Firebase Email/Password sign-in, depending on provider |
| `/register` | Demo registration scaffold or Firebase participant registration |
| `/participant` | Participant dashboard with labelled demo data |
| `/participant/upload` | Demo EEG upload with client-side validation and consent |
| `/participant/upload/processing/[sessionId]` | Simulated processing timeline for an in-memory demo upload |
| `/participant/sessions` | Session history with preloaded fixtures and in-memory demo uploads |
| `/participant/sessions/[sessionId]` | Metadata-only demo session record with unavailable analysis states |
| `/participant/activities` | Cognitive activity library with five planned activities and one interactive CPT |
| `/participant/activities/cpt` | Interactive demo Continuous Performance Task with practice, scored trials, and in-memory summary |
| `/participant/activities/history` | In-memory history of completed scored CPT runs |
| `/participant/activities/history/[runId]` | In-memory CPT run summary with calculated metrics and trial-event review |
| `/participant/progress` | Descriptive CPT progress metrics and multi-run trends from in-memory runs |
| `/participant/digital-twin` | Research Digital Twin profile built from in-memory CPT measurements |
| `/clinician` | Clinician dashboard with derived demo counts and roster links |
| `/clinician/participants` | Searchable synthetic participant roster with status filters |
| `/clinician/participants/[id]` | Participant overview with linked in-memory CPT context and unavailable EEG/model states |
| `/clinician/participants/[id]/eeg` | EEG availability view with a separately labelled illustrative visualization |
| `/clinician/participants/[id]/behavior` | Descriptive behavioral activity summary from linked in-memory CPT runs |
| `/clinician/participants/[id]/report` | Browser-printable research report limited to available synthetic and in-memory data |
| `/clinician/compare` | Same-participant comparison of eligible scored CPT runs |
| `/research` | Research dashboard with synthetic model, experiment, dataset, and explainability availability states |
| `/research/models` | Model metadata comparison with illustrative metrics and unavailable evaluation outputs |
| `/research/experiments` | Searchable and filterable synthetic experiment plan inventory |
| `/research/experiments/[id]` | Experiment plan detail with dataset/model references, limitations, and reproducibility notes |
| `/research/datasets` | Dataset metadata inventory with availability and local-file verification states |
| `/research/explainability` | Illustrative feature-importance fixture with explicit unavailable attribution outputs |

## Project Structure

```text
src/app/          Routes, layouts, global styles
src/components/   Shared UI, layout, feedback, and chart components
src/features/     Feature-specific UI and local validation
src/data/demo/    Synthetic demonstration fixtures
src/lib/          Utilities, API helper, typed service layer
src/types/        Shared domain types
docs/             Architecture and roadmap documentation
```

## Documentation

- [Frontend architecture](docs/FRONTEND_ARCHITECTURE.md)
- [Frontend roadmap](docs/FRONTEND_ROADMAP.md)
- [API integration readiness](docs/API_INTEGRATION_READINESS.md)
- [Firebase setup and limitations](docs/FIREBASE_SETUP.md)

## Current Scope

Milestone 1 establishes the design system, public site, auth scaffolds, app
shell, and participant dashboard. Milestone 2 adds the participant
upload-to-review journey: client-side file checks, consent acknowledgement, a
manually advanced simulated processing timeline, and a metadata-only session
record. Milestone 3 adds the cognitive activity library and an interactive
Continuous Performance Task with practice feedback, 24 deterministic scored
trials, browser-calculated descriptive metrics, and an in-memory run summary.
Milestone 4 adds activity history, per-run summary and trial-event review, and
a progress view with aggregate metrics and multi-run trends. Milestone 5 adds a
research Digital Twin profile that summarizes those CPT measurements, exposes
baseline and data-quality states, and clearly marks unavailable EEG, model, and
external modalities. Milestone 6 adds the clinician roster, participant
overview, and derived dashboard counts. Milestone 7 adds clinician EEG
availability, behavioral activity summaries, same-participant CPT session
comparison, and a browser-printable research report. Milestone 8 adds the
researcher portal: a research dashboard, model metadata comparison, experiment
plan inventory and detail views, dataset metadata inventory, and an illustrative
explainability view. The EEG preview is a separate synthetic illustration and
is not linked to any participant. Demo uploads and activity results live in
memory and reset on reload. Milestone 9 adds a typed API client and centralized
provider selection; remote mode remains unavailable until a backend contract
is confirmed. Firebase mode supports Email/Password accounts, UID-owned
participant profiles, and opt-in CPT summary/session/report/Digital Twin
persistence without raw trial events or EEG files. Firebase configuration is
present and rules are deployed; post-deployment live read/write verification
remains outstanding. The remaining activities, cohort reporting, session-review
actions, caregiver surfaces, and settings remain previews or planned work; see
the roadmap for details. Milestone 10 audited the route tree and key workflows,
fixed upload cancellation and file-error accessibility behavior, and verified
demo/remote build behavior. Browser interaction testing was not performed.

## Data Policy

- Demo fixtures are isolated in `src/data/demo/`.
- Every demo surface is labelled as demonstration data.
- Application code never stores passwords, EEG files, or participant records in
  browser storage. Firebase Auth manages its own browser-local sign-in
  persistence; Firestore account documents remain in the configured project.
- Demo uploads inspect only file name, extension, and size. File contents are
  never read, uploaded, or stored.
- Demo upload metadata and processing progress live in memory and reset on
  reload.
- Demo-mode CPT event logs and run summaries live in memory and reset on reload.
  Firebase mode can persist summary metrics only after the user opts in; raw
  trial events are not uploaded. These are not clinical scores.
- Activity history and progress derive from scored CPT runs. Demo runs are
  session-memory only; Firebase mode reads the signed-in user's saved summary
  metrics and current browser runs. Practice trials are excluded from progress.
- The Digital Twin profile reuses the shared CPT summary calculations over
  available browser and Firebase summary records. It does not include
  EEG-derived features, model inference, a learned brain representation, or a
  clinical assessment.
- Clinician behavioral summaries and session comparisons read the same
  in-memory CPT records. Comparisons are limited to different eligible scored
  runs from the same participant; practice runs, incomplete trial logs, and
  cross-participant comparisons are excluded.
- The clinician EEG page has no linked recording data. Its waveform and
  band-power preview use a separate synthetic fixture and are not associated
  with a participant, session, preprocessing result, or model output.
- The clinician print report is assembled from synthetic roster context and
  available CPT data; printing uses the browser print dialog and creates no
  PDF. Firebase participant CPT report summaries are separate and are saved
  only after an explicit user action while cloud sync is enabled.
- Research model, experiment, dataset, and explainability records are synthetic
  fixtures. Model metrics are illustrative placeholders; precision and recall
  are not provided. No model is trained, evaluated, or executed.
- Research experiments are planning records only. No experiment has run, no
  result store exists, and no result or conclusion is inferred.
- Dataset entries are metadata-only. No local dataset file is verified, read,
  uploaded, downloaded, or inspected.
- Explainability values are synthetic feature-importance placeholders, not SHAP,
  permutation, attention, or other computed attributions. Channel, frequency,
  temporal, causal, and clinical explanations are unavailable.
- `NEXT_PUBLIC_DATA_PROVIDER` defaults to `demo`. Selecting `remote` hides
  demo-backed workspace views and reports missing configuration or unconfirmed
  backend contracts; it never silently falls back to synthetic fixture data.
- `NEXT_PUBLIC_API_BASE_URL` is a public placeholder setting only. A configured
  URL does not enable requests, and it must never contain credentials or tokens.
- `NEXT_PUBLIC_DATA_PROVIDER=firebase` requires the Firebase Web App values in
  `.env.example`; missing values produce an unavailable state rather than demo
  fallback. Firebase settings are public configuration, never credentials.
- Firebase Auth manages credentials and authentication persistence. Firestore
  stores only each authenticated participant's profile and explicitly enabled
  summary metadata; no passwords, ID tokens, raw CPT events, or EEG content are
  written by the frontend.
- Firebase cloud sync is off by default. Turning it off stops future app-session,
  activity-summary, report-summary, and Digital Twin writes but does not delete
  records already stored in Firestore. This preference is not research, guardian,
  or child-assent consent.
- Firebase mode exposes participant-owned data only. Clinician and researcher
  data remain unavailable until a trusted staff authorization design exists.
- No custom backend endpoints are invented or called. Firebase Auth and
  Firestore endpoints are used only when Firebase mode is configured.
