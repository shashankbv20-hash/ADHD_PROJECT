# Firestore index notes

No Firestore indexes were deployed or added to the frontend Firebase project as
part of this task. These are the composite query patterns used by the Admin SDK
repository; Firestore may report a console link to create the corresponding
index if one is needed by the selected project/database.

| Collection scope | Fields / direction | Query |
|---|---|---|
| `subjects` | `owner_user_id` ASC, `is_active` ASC, `created_at` DESC | Participant subject listing. |
| `subjects/{id}/caregiverRelationships` | `caregiver_user_id` ASC | Relationship idempotency lookup. |
| `caregiverSubjectIndex/{uid}/subjects` | `status` ASC | Caregiver subject/session lookup. |
| `subjects/{id}/consents` | `scope` ASC, `idempotency_key` ASC; `scope` ASC, `status` ASC | Consent retry lookup and active-grant supersession. The current consent pointer itself is a direct document read. |
| `subjects/{id}/sessions` | `created_at` DESC | Stable subject session history. |
| `subjects/{id}/activitySummaries` | `created_at` DESC | Summary pages and history. |
| `subjects/{id}/reports` | `created_at` DESC | Report listing. Idempotency uses a stable direct document at `reportIdempotency/{keyHash}` (no query index). |
| `activities/cpt/configurations` | `is_current` ASC, `created_at` DESC | Active versioned CPT configuration. |

Most nested collections are scoped by parent document, reducing the need for
collection-group queries. Session and summary pages use server-side Firestore
`limit` plus `(created_at, document ID)` cursor ordering. Review index
requirements against the actual Firestore project before deploying any index
configuration.
