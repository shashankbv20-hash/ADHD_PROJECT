# Attune Frontend Roadmap

## Status

**Milestone 1: foundation — complete.**

The current build includes the public landing page, auth scaffolds, responsive
workspace shell, participant dashboard, participant upload-to-review journey,
session history, cognitive activity library with an interactive CPT, in-memory
activity history and progress views, a research Digital Twin profile, a clinician
portal with advanced participant views, and a researcher portal for model,
experiment, dataset, and explainability metadata. All displayed records and
metrics are synthetic or demo-calculated.

**Milestone 2 core journey: complete.** The upload, validation, simulated
processing, and metadata-only session record flow is implemented with in-memory
demo state.

**Milestone 3 cognitive activity library: complete.** The participant activity
library includes one interactive Continuous Performance Task (CPT) and five
clearly marked planned activities. CPT practice, scored trials, descriptive
metrics, and in-memory run summaries are implemented.

**Milestone 4 activity history and progress: complete.** Completed scored CPT
runs can be reviewed in an in-memory history, opened as per-run summaries with
trial-event tables, and aggregated into descriptive progress metrics and
multi-run trends. Practice runs remain excluded from saved history and progress.

**Milestone 5 research Digital Twin profile: complete.** The participant Digital
Twin page summarizes available CPT measurements, reuses the progress
calculations, exposes a first-run demo baseline, and clearly marks EEG-derived
features, model inference, webcam, and external APIs as unavailable.

**Milestone 6 clinician portal: complete.** The clinician workspace includes a
searchable synthetic roster, derived dashboard counts, and participant overviews
with linked in-memory CPT context and explicit unavailable EEG/model states.

**Milestone 7 advanced clinician features: complete.** Clinician participant
subroutes provide EEG availability, behavioral activity summaries, session
comparison, and a browser-printable research report. All values remain
descriptive and limited to synthetic or in-memory data.

**Milestone 8 researcher portal: complete.** The research workspace includes
model comparison, experiment plans and details, dataset metadata, and
illustrative explainability states.

**Milestone 9 frontend API integration readiness: complete.** Typed logical
contract proposals, a centralized JSON client, demo/remote provider selection,
configuration/error states, and integration documentation are in place. No
backend endpoints are verified or called; remote mode remains explicitly
unavailable until specifications are approved.

This roadmap is a plan, not a claim of completed backend or clinical capability.

## Product Guardrails

- Frontend-only scope. No backend, database, signal processing, or ML inference.
- Every synthetic value must be labelled as demonstration data.
- Never present invented values as real EEG measurements or validated results.
- No diagnostic or treatment claims.
- No credentials or sensitive data in browser storage.
- Unavailable services must produce explicit, usable UI states.

## Milestone 1 — Foundation (Complete)

Delivered:

- Next.js App Router, TypeScript, Tailwind CSS 4, Lucide, and Recharts setup.
- Design tokens, typography, focus states, responsive layout, and branding.
- Reusable UI primitives and chart wrappers.
- Public landing page with research-purpose and transparency content.
- Sign-in and registration interface scaffolds with local validation and an
  explicit "authentication unavailable" result.
- Responsive workspace shell with role navigation and mobile drawer.
- Participant dashboard with labelled demo metrics, focus trend, band-power
  preview, recent sessions, Digital Twin snapshot, weekly activity, and
  cognitive activity summaries.
- Session history preview with status filters, search, and empty state.
- Early clinician and research overview previews using synthetic fixtures.
- Loading, error, empty, validation, and unsupported-capability states.
- Typed service layer and demo fixtures separated from presentation.
- Architecture and roadmap documentation.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Milestone 2 — Participant Core Journey

Goal: make the participant workflow coherent from upload through review.

Status: the core upload-to-review journey is implemented. The cognitive activity
launcher was delivered in Milestone 3, and the research Digital Twin profile was
delivered in Milestone 5. EEG-derived traits and model inference remain
unavailable.

Delivered:

- EEG upload interface with drag-and-drop, client-side file type/size checks,
  consent acknowledgement, cancellation, and validation retry.
- In-memory demo session records with deterministic IDs and a manual simulated
  processing timeline.
- Metadata-only session record with explicit "not assessed", "not generated",
  and "not available" analysis states.
- Missing-session, cancelled-upload, and reload-reset states with recovery
  links.
- Typed contracts for demo upload sessions and processing stages.
- Dashboard, sidebar, and session-history entry points into the journey.

Delivered in later milestones from the original Milestone 2 scope:

- Research Digital Twin profile page with measurement provenance and explicit
  unavailable-modality states (Milestone 5). EEG-derived traits remain
  unavailable.

Scope:

- EEG upload interface with drag-and-drop, file type/size validation, and
  consent acknowledgement.
- Upload progress, cancellation, validation failure, and retry states.
- Analysis processing status timeline with honest "service unavailable" and
  "not connected" states.
- Session detail view with signal quality, artifact flags, and illustrative
  feature summaries.
- Research Digital Twin profile page with measurement provenance and explicit
  unavailable-modality states.
- Typed contracts for upload, processing status, session detail, and profile
  data.

Explicitly not included:

- Real EEG parsing or preprocessing.
- Real model inference.
- Persistent storage.

Acceptance criteria:

- A participant can move from dashboard to upload to processing to session detail
  without dead ends.
- Every unavailable service state is explained.
- Demo data remains labelled at each step.
- Mobile and keyboard flows are verified.

## Milestone 3 — Cognitive Activity Library (Complete)

Goal: provide a coherent participant activity library with one fully
interactive attention task.

Delivered:

- Six-card cognitive activity library: Continuous Performance Task, Go / No-Go,
  Selective Attention, N-back, Visual Sequence Memory, and Focus Arena.
- Only the CPT is interactive; the other five cards are clearly marked as
  planned and do not start a task.
- CPT practice sequence with per-trial feedback, followed by 24 deterministic
  scored trials containing six target trials.
- Browser-calculated descriptive metrics: hits, misses, false alarms, correct
  rejections, accuracy, response count, and mean hit reaction time.
- Trial-by-trial event table and a separate calculated-metrics summary.
- In-memory `ActivitySessionProvider` with recent CPT runs; results reset on
  reload and are never written to browser storage.
- Keyboard Space and pointer response controls, pause/resume with current-trial
  restart, focus management, and timer cleanup.
- Sidebar, dashboard activity card, and route-title integration.
- Typed activity definitions, CPT trial events, metrics, and run summaries.

Explicitly not included:

- Clinical validation, diagnostic interpretation, or normative scoring.
- Persistent activity history or backend synchronization.
- The five planned activities beyond their library cards.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Milestone 4 — Activity History and Progress (Complete)

Goal: connect recorded CPT runs to reviewable history and descriptive progress.

Delivered:

- Newest-first in-memory activity history for completed scored CPT runs.
- Per-run summary route with calculated metrics, raw trial-event review, and
  explicit missing-record recovery after a reload or history clear.
- Progress view with completed-run count, scored-trial count, aggregate
  accuracy, target detections, false alarms, and valid mean hit reaction time.
- Accuracy and reaction-time trend charts gated until at least two comparable
  scored runs exist, with single-run and no-run empty states.
- Copy that distinguishes raw trial events from calculated metrics and labels
  all values as descriptive, non-clinical demo data.
- Sidebar, dashboard, activity-library, and route-title integration.
- Documentation of in-memory reset behavior and the absence of persistence.

Explicitly not included:

- Persisting practice runs or activity history to browser storage.
- Backend synchronization, clinical interpretation, or normative scoring.
- Caregiver, settings, session-comparison, and export surfaces.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Milestone 4B — Caregiver and Settings (Planned)

- Caregiver-visible summaries with permission-aware interface language.
- Profile and notification settings scaffolds.
- Caregiver-facing report entry points with explicit "not connected" states.
- Accessibility audit and responsive regression pass.

Note: clinician session comparison and participant research reports were
delivered in Milestone 7.

## Milestone 5 — Digital Twin Profile and Research Insights (Complete)

Goal: provide a participant-facing research profile built only from available
frontend measurements.

Delivered:

- `/participant/digital-twin` profile with purpose and limitation disclosure.
- Aggregate CPT metrics, observation counts, comparable-session counts, and
  complete trial-log counts from in-memory scored runs.
- First-run demo baseline reference with an explicit calculation method and
  latest-versus-baseline differences only when at least two runs exist.
- Reuse of the existing progress summary and trend charts so Digital Twin
  metrics match the progress page.
- Modality status cards for cognitive activity, EEG recordings, EEG-derived
  features, learned-model availability, webcam, and external APIs.
- Data-quality and profile-configuration states that mark unsupported editing,
  baseline selection, export, and synchronization as unavailable.
- Sidebar, dashboard preview, progress-page, and route-title integration.

Explicitly not included:

- EEG preprocessing, derived EEG features, model training, or inference.
- A learned representation of the participant or any predictive claim.
- Profile editing, baseline selection, export, or backend synchronization.
- Persistent storage of activity, EEG, or personal data.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Milestone 6 — Clinician Portal (Complete)

Completed:

- Participant roster with client-side search and a roster-status filter.
- Participant overview with roster context, linked in-memory CPT metrics,
  Digital Twin availability, and explicit missing-data states.
- Dashboard counts derived from the synthetic roster and review-queue fixtures.
- Dashboard and navigation links to the roster and participant overviews.
- Explicit authorization boundaries in the UI; no real authorization until an
  auth service exists.

Deferred:

- Session review actions and assignment states.
- Cohort-level reporting and cross-participant analytics.
- Review queue actions and production authorization.

## Milestone 7 — Advanced Clinician Features (Complete)

Goal: extend the clinician portal with EEG availability, behavioral summaries,
session comparison, and a printable research report without inventing clinical
or EEG data.

Delivered:

- Participant subnavigation for overview, EEG, behavior, and report views.
- `/clinician/participants/[id]/eeg` with explicit unavailable states for raw
  EEG, recording metadata, quality assessment, frequency-band analysis,
  preprocessing, and model inference.
- A separately labelled illustrative waveform and band-power fixture that is
  never associated with a participant or recording.
- `/clinician/participants/[id]/behavior` with linked CPT metrics, run-level
  detail, task configuration, data completeness, observation window, and
  descriptive first-versus-latest differences.
- `/clinician/compare` with same-participant selection, eligible scored-run
  filtering, captioned comparison tables, and missing-value states.
- `/clinician/participants/[id]/report` with participant context, CPT summary,
  trend table, Digital Twin availability, limitations, and browser printing.
- Sidebar, dashboard, participant overview, and route-title integration.
- Documentation of eligibility rules, illustrative EEG provenance, print
  behavior, and non-clinical interpretation boundaries.

Explicitly not included:

- Real EEG upload, parsing, preprocessing, quality scoring, or feature
  extraction.
- EEG-derived model inference or any learned Digital Twin representation.
- Cross-participant comparison, cohort reporting, or population analytics.
- Report persistence, PDF generation, server-side export, or clinical use.
- Diagnosis, severity classification, prognosis, or treatment recommendations.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Milestone 8 — Researcher Portal (Complete)

Goal: provide a read-only research workspace for model, experiment, dataset, and
explainability metadata without inventing training, execution, dataset files, or
validated results.

Delivered:

- `/research` dashboard with derived model, experiment, dataset, and
  explainability counts plus availability states and cross-links.
- `/research/models` comparison of synthetic model metadata, illustrative
  accuracy/F1/AUC values, unavailable precision/recall, and explicit
  unavailable confusion-matrix and ROC outputs.
- `/research/experiments` searchable and lifecycle-filterable experiment plan
  inventory with no-results handling.
- `/research/experiments/[id]` plan detail with research question, methodology,
  dataset and model references, execution status, limitations, reproducibility
  notes, and an unknown-ID state.
- `/research/datasets` searchable dataset metadata inventory with availability
  filters, participant/sample counts only when documented, and explicit
  unverified local-file states.
- `/research/explainability` with an illustrative feature-importance chart,
  method/provenance, unavailable channel/frequency/temporal/causal outputs, and
  limitation notices.
- Researcher sidebar links, route titles, and documentation integration.

Explicitly not included:

- Experiment creation, editing, execution, result storage, or run history.
- Dataset upload, download, file inspection, validation, or persistence.
- Model training, inference, evaluation, ranking, or superiority claims.
- Computed SHAP, permutation, attention, or other explanations.
- Administration surfaces or write access for research records.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Milestone 9 — Frontend API Integration Readiness (Complete)

Delivered:

- `src/types/api.ts` logical request/response DTO proposals based on existing
  frontend types, with endpoint paths, HTTP methods, and server envelopes
  explicitly left unconfirmed.
- A centralized JSON API client with typed configuration, network, HTTP,
  invalid-response, request, and cancellation errors; injectable fetcher;
  cancellation; and no automatic retries, timeouts, caching, or file upload.
- Centralized build-time provider configuration. Demo mode remains the default;
  remote mode shows a not-configured or contract-unconfirmed state and never
  falls back to fixtures.
- Separate demo adapters and remote placeholders for participant, clinician,
  activity, and research service interfaces.
- EEG upload integration requirements and security dependencies documented in
  `docs/API_INTEGRATION_READINESS.md`.
- Safe shared API error presentation and sanitized route-error logging.

Not included in Milestone 9: custom backend implementation, custom API calls,
EEG upload transport, preprocessing, model inference, or actual contract tests.
Participant Firebase authentication and owner-scoped Firestore source integration
are documented separately below; cloud verification remains pending.

## Milestone 10 — Final Frontend QA and Release Polish (Complete)

Delivered:

- Audited the actual public, participant, clinician, researcher, and system route
  tree; confirmed public transparency content is a section on `/` rather than a
  separate methodology route, and no profile/settings routes are implemented.
- Fixed a demo-upload cancellation race that could create a session after the
  user navigated away during the preparation delay.
- Associated the upload file validation error with both the hidden file input
  and the visible file-picker control for assistive technology.
- Corrected the API readiness guide's provider-build-time configuration note,
  clarified direct demo metadata imports in the architecture guide, and updated
  README/roadmap scope descriptions.
- Verified upload validation boundaries, CPT trial scoring, provider config,
  API-client error handling, and demo/remote production builds.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run build` in default demo mode
- Production builds in remote mode with no base URL and with a placeholder base
  URL; neither used a backend endpoint or rendered demo records in the remote
  workspace.
- Project has no first-party automated test suite or browser-test configuration.
  No suitable local server was running, so browser interaction verification was
  not performed.

## Deferred or Out of Scope

- FastAPI backend, databases, migrations, and servers.
- EEG preprocessing, CNN/LSTM/attention/Transformer implementations.
- PyTorch training and inference.
- Real-time EEG hardware acquisition.
- WebSocket services.
- Production staff authorization and role management.
- Clinical validation or diagnostic claims.

## Firebase Participant Integration Status (Configured; browser smoke test pending)

- Modular Firebase Web SDK integration supports Email/Password participant
  registration, sign-in, sign-out, password reset, persistent Auth state, and
  UID-owned participant profile initialization/recovery.
- Optional cloud sync defaults off and gates CPT summary, CPT app-session,
  explicitly saved report-summary, and supported Digital Twin snapshot writes.
- Firestore client services, restrictive `firestore.rules`, Firebase CLI
  configuration files, and `docs/FIREBASE_SETUP.md` are present under
  `frontend/`.
- Firebase Web App values and `.firebaserc` target `adhd-bf37a`; the default
  Firestore database exists. Rules were deployed and the active release matches
  the local rules file.
- Authenticated profile reads, profile creation, persistence, cross-user denial,
  and Google/email browser flows still require a controlled live smoke test.
  See `docs/FIREBASE_SETUP.md`.

## Next Recommended Step

Milestone 10 frontend QA is complete. Firebase source integration and the
Firestore rules deployment are present; complete the remaining browser smoke
test before relying on live participant persistence. Backend work remains
separate and must follow the repository-root `backend_plan.md`.
