# Firebase Participant Integration Setup

## Implementation and verification status

The frontend source includes Firebase Authentication and participant-scoped
Firestore services using the modular Firebase Web SDK. The local Web App
configuration and `.firebaserc` target project `adhd-bf37a` (`ADHD`), and the
default Firestore database is present. The local restrictive Firestore rules
were deployed and the active release was verified to match `firestore.rules`.
Browser-level profile/persistence smoke tests remain outstanding.

The project includes the modular Firebase JavaScript SDK `firebase@^11.10.0`.
Firebase Admin SDK is not installed or used in the browser.

Firebase CLI 15.34.2 is available through `npx firebase-tools`. Project access
and the registered frontend app were verified for `adhd-bf37a`. Run Firebase
commands from `frontend/` so `firebase.json` and `.firebaserc` are used:

```bash
npx firebase-tools projects:list
npx firebase-tools firestore:databases:list --project adhd-bf37a
```

If multiple projects are accessible, compare the selected project with
`NEXT_PUBLIC_FIREBASE_PROJECT_ID`; do not switch projects implicitly. Do not
create a database or select a region as part of frontend development.

## Environment configuration

The default remains `NEXT_PUBLIC_DATA_PROVIDER=demo`. To build the Firebase
participant provider, create or update your local `.env.local` without
overwriting an existing file:

```dotenv
NEXT_PUBLIC_DATA_PROVIDER=firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
```

Copy the five values from the intended Firebase Console **Project settings →
General → Your apps → Web app configuration**. The values are public Firebase
Web App configuration, not service-account credentials. Never add service
account JSON, private keys, passwords, or privileged tokens to `NEXT_PUBLIC_*`
variables or the repository. Next.js embeds public values at build time, so
restart the development server after local configuration changes and rebuild
before deploying a different provider.

`.env.example` contains blank placeholders and keeps demo mode as its default.
The existing `.env.local` was preserved during repository organization and
remains ignored by the repository-level `.gitignore`.

## Firebase Console setup

1. Select project `adhd-bf37a`; this frontend does not create Firebase projects.
2. The existing Web App config was compared with the registered Web App. If
   replacing local config, copy public values from **Project settings → General
   → Your apps → Web app configuration**.
3. In **Authentication → Sign-in method**, verify Email/Password and Google
   status before browser testing. Do not assume provider status from code alone.
4. The existing `(default)` Firestore database was verified. Do not create a
   second database or change its region as part of this frontend work.
5. Rules were reviewed and deployed to this verified project; the current active
   release matches the local restrictive rules file. Do not use public or
   cross-user access rules.

For a future rules-only deployment after reviewing any rule changes, run from
`frontend/` and keep the explicit project target:

```bash
npx firebase-tools deploy --only firestore:rules --project adhd-bf37a
```

Do not run this command against another project without explicit verification.
`firebase.json` points to the rules and index files in this frontend directory;
`.firebaserc` associates the default alias with `adhd-bf37a`.
`firestore.indexes.json` currently has no composite indexes because implemented
queries order by one field at a time.

## Authentication behavior

- Firebase Authentication owns Email/Password registration, sign-in, sign-out,
  password reset, and browser-local authentication persistence.
- Public Firebase registration always creates the `participant` role. The
  Firebase form does not expose caregiver, clinician, researcher, or admin role
  selection.
- On sign-in, the frontend initializes or validates `users/{uid}` using the
  authenticated Firebase UID. Profile recovery is available if Auth succeeds
  but Firestore profile initialization fails.
- The Firestore user profile stores only `uid`, `displayName`, fixed `role`,
  `cloudSyncEnabled` (default `false`), `createdAt`, and `updatedAt`.
- Passwords and Firebase ID tokens are not written to Firestore or application
  local storage by this code. Firebase SDK manages its own authentication
  persistence.
- Firebase mode exposes the participant workspace only. Clinician and
  researcher access remains unavailable pending a trusted staff authorization
  design; client-controlled role fields are not authorization.

## Firestore collections

| Path | Contents and behavior |
| --- | --- |
| `users/{uid}` | Required owner profile. Document ID must equal the Auth UID. Role is fixed to `participant`; cloud sync defaults off. |
| `users/{uid}/appSessions/{sessionId}` | Metadata for a completed CPT application session only: activity, status, timestamps, trial count, schema version, and provenance. No EEG file name, file contents, signal, or authentication token. |
| `users/{uid}/activityRuns/{runId}` | Scored CPT summary metrics, completion time, schema version, and `frontend-cpt-demo-v1` provenance. Raw trial events and response timelines are deliberately omitted. |
| `users/{uid}/reports/{reportId}` | CPT summary metrics created only after the user explicitly chooses **Save report summary**. No automatic report save and no clinical finding. |
| `users/{uid}/digitalTwin/current` | Shared-helper-derived CPT profile summary, source run IDs, calculation/provenance version, supported data-quality fields, and update time. No EEG features or predictions. |

Firestore creates these collections/documents implicitly when authorized writes
occur. Their presence is not claimed until a successful write has been verified
against the configured project.

## Cloud synchronization setting

The participant-facing Digital Twin profile and dashboard provide:

> Save future activity summaries and application session metadata to my Firebase account.

The preference defaults to `false`. The required participant profile still
exists for an authenticated account, but application-session metadata, scored
summary, saved report-summary, and Digital Twin snapshot writes are gated by
this preference. Existing stored user-owned records remain readable when the
setting is turned off; turning sync off does not delete them. Earlier in-memory
demo runs are never automatically migrated.

Only newly completed scored CPT summaries may be synced, using existing CPT
scoring and Digital Twin helpers. The task remains a frontend demonstration,
not a clinically validated assessment. Summary writes are idempotent by run ID.
Raw trial events, reaction-time timelines, EEG recordings, EEG signals, and
Firebase credentials are not uploaded.

Report summaries use a separate explicit user action and are also blocked while
cloud sync is disabled.

## Security Rules

`firestore.rules` is prepared for the schema above and denies unspecified paths
by default. It requires authentication, enforces owner UID paths, fixes the
public account role to `participant`, restricts profile fields, and gates
application-session/activity/report/Digital Twin writes on the profile's
`cloudSyncEnabled` value. Client-side writes cannot modify roles, read another
participant's documents, or delete stored records.

The rules do not authorize clinician/researcher access or claim production
authorization. Firebase CLI compilation and deployment succeeded for
`adhd-bf37a`; the active release was verified to match the local source. No
Firestore Emulator security test suite is configured, and authenticated
browser-level read/write tests remain outstanding.

## Verification commands

Available local checks:

```bash
npm run lint
npm run typecheck
npm run build
```

No first-party test runner or Firebase Emulator configuration is present. Real
Auth, Firestore, Rules, and persistence smoke tests require the configured
Firebase Web App, an existing/provisioned Firestore database, Email/Password
enabled, and approved Rules. Do not use real participant, child, clinical, or
EEG data; use an account and synthetic data owned by the project developer.

## Current limitations

- Project ID, registered Web App, default Firestore database, and active rules
  are verified for `adhd-bf37a`.
- Firestore rules are deployed and match the local source. The earlier
  permission-denied log entries predate that deployment; a fresh authenticated
  profile-read test is still required.
- Authentication provider status should be reconfirmed in Firebase Console
  before testing Email/Password and Google flows.
- Authenticated browser persistence tests have not been performed from this
  workspace.
- EEG upload, Firebase Storage, EEG processing, model inference, production
  authentication authorization, and clinician/researcher data access are not
  implemented.
- Firebase records contain summary metrics only; saved activity detail does
  not include trial-by-trial events.
