import type { BackendClient } from "@/lib/backend/client";
import type {
  BackendActivitySummary,
  BackendCptEvent,
  BackendSession,
  BackendSubject,
} from "@/lib/backend/types";
import { ApiClientError } from "@/lib/api-client";
import type { CptRunSummary } from "@/types";

export type CptSyncResult =
  /** The server validated, scored and stored the run. `summary` is server-calculated. */
  | { status: "synced"; sessionId: string; subjectId: string; summary: BackendActivitySummary | null }
  /** No active research consent exists. Nothing was created or uploaded. */
  | { status: "consent-required"; subjectId: string | null };

/**
 * Stable per-run retry key. Backend session creation is idempotent per
 * (user, key), so re-running a failed sync resumes the same server session.
 */
export function cptSessionIdempotencyKey(runId: string): string {
  return `cpt-run-${runId}`;
}

export function toBackendEvents(run: CptRunSummary): BackendCptEvent[] {
  return run.events.map((event) => ({
    trialIndex: event.trialIndex,
    trialId: event.trialId,
    stimulus: event.stimulus,
    isTarget: event.isTarget,
    responded: event.responded,
    reactionTimeMs: event.reactionTimeMs,
    outcome: event.outcome,
  }));
}

/** Returns the participant's own active subject, or null. Never creates one. */
export async function findOwnSubject(client: BackendClient): Promise<BackendSubject | null> {
  const { items } = await client.listSubjects();
  return items.find((subject) => subject.isActive) ?? null;
}

/**
 * Returns the participant's own subject, creating it if needed. Call this only
 * from an explicit user action (granting consent), never on page load.
 */
export async function ensureOwnSubject(client: BackendClient): Promise<BackendSubject> {
  return (await findOwnSubject(client)) ?? client.createSubject();
}

/** True only when the subject currently has a granted research consent. */
export async function hasActiveResearchConsent(
  client: BackendClient,
  subjectId: string,
): Promise<boolean> {
  const { items } = await client.listConsents(subjectId);
  return items.some((consent) => consent.scope === "research" && consent.status === "granted");
}

function isConsentRequired(error: unknown): boolean {
  return error instanceof ApiClientError && error.backendCode === "consent_required";
}

/**
 * Persists one completed *scored* CPT run through the backend so the server
 * validates the trial sequence and calculates the metrics. Client-side totals
 * are never sent.
 *
 * This function never grants consent and never creates a subject. If there is
 * no subject yet or research consent is missing it returns `consent-required`
 * without creating anything, so the caller can show the participant an
 * explicit consent step.
 *
 * Every step is state-driven and idempotent, so a failed attempt can simply be
 * retried with the same run.
 */
export async function syncScoredCptRun(
  client: BackendClient,
  run: CptRunSummary,
): Promise<CptSyncResult> {
  if (run.mode !== "scored") {
    throw new Error("Only scored CPT runs are persisted; practice runs are never uploaded.");
  }

  const subject = await findOwnSubject(client);

  if (!subject || !(await hasActiveResearchConsent(client, subject.id))) {
    return { status: "consent-required", subjectId: subject?.id ?? null };
  }

  let session: BackendSession;
  try {
    session = await client.createSession({
      subjectId: subject.id,
      activities: [{ activityCode: "cpt", mode: "scored" }],
      idempotencyKey: cptSessionIdempotencyKey(run.id),
    });
  } catch (error) {
    // Consent could be withdrawn between the check above and this call.
    if (isConsentRequired(error)) {
      return { status: "consent-required", subjectId: subject.id };
    }
    throw error;
  }

  const assignment = session.activities.find((activity) => activity.activityCode === "cpt");
  if (!assignment) {
    throw new Error("The server session did not include a CPT activity.");
  }

  if (session.status === "created") {
    session = await client.startSession(session.id);
  }

  const current = () => session.activities.find((activity) => activity.id === assignment.id);

  if (current()?.status === "assigned") {
    session = await client.startActivity(session.id, assignment.id);
  }

  if (current()?.status !== "completed") {
    await client.ingestEvents(session.id, assignment.id, toBackendEvents(run));
    session = await client.completeActivity(session.id, assignment.id);
  }

  const summaries = await client.getSessionSummaries(session.id);
  const summary = summaries.find((item) => item.sessionActivityId === assignment.id) ?? null;

  return { status: "synced", sessionId: session.id, subjectId: subject.id, summary };
}
