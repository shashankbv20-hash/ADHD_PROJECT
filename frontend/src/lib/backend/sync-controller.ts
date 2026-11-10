import { ApiClientError } from "@/lib/api-client";
import type { BackendClient } from "@/lib/backend/client";
import {
  RESEARCH_CONSENT_VERSION,
  newConsentIdempotencyKey,
} from "@/lib/backend/consent";
import {
  ensureOwnSubject,
  findOwnSubject,
  syncScoredCptRun,
  type CptSyncResult,
} from "@/lib/backend/cpt-sync";
import { summaryToCptRun } from "@/lib/backend/summary-mapping";
import type { BackendConsent } from "@/lib/backend/types";
import type { CptRunSummary } from "@/types";

/** Thrown when a run cannot be saved yet because research consent is missing. */
export class ConsentRequiredError extends Error {
  constructor() {
    super(
      "This run is not saved yet because research consent has not been granted. Grant consent on the Digital Twin page, then retry; the run stays in this browser session until then.",
    );
    this.name = "ConsentRequiredError";
  }
}

export interface BackendSyncSnapshot {
  /** Null until the participant first grants consent; nothing is created before that. */
  subjectId: string | null;
  consent: { status: "granted"; id: string; version: string } | { status: "none" };
  /** Server-calculated scored runs, newest first. Trial events stay on the server. */
  serverRuns: CptRunSummary[];
}

export interface PersistOutcome {
  /** ID of the server run that now represents the persisted browser run. */
  serverRunId: string | null;
  message: string;
}

function activeResearchConsent(consents: readonly BackendConsent[]): BackendConsent | null {
  return (
    consents.find((consent) => consent.scope === "research" && consent.status === "granted") ??
    null
  );
}

/** User-safe wording for failures; never includes server-provided text. */
export function describeSyncError(error: unknown): string {
  if (error instanceof ConsentRequiredError) {
    return error.message;
  }

  if (error instanceof ApiClientError) {
    if (error.code === "auth-token-unavailable") {
      return "Sign in again to save to the research backend.";
    }
    if (error.kind === "network") {
      return "The research backend could not be reached. Your result stays in this browser session; try again shortly.";
    }
    const reference = error.requestId ? ` (reference ${error.requestId})` : "";
    if (error.status === 403) {
      return `The research backend declined this request${reference}.`;
    }
    return `The research backend could not complete the request${reference}. Your result stays in this browser session.`;
  }

  return "The research backend request failed. Your result stays in this browser session.";
}

/**
 * Framework-free coordination of consent and CPT persistence against the
 * backend. React state lives in `BackendSyncProvider`; the logic is here so it
 * can be unit tested without a DOM.
 */
export function createBackendSyncController({
  client,
  participantId,
  consentVersion = RESEARCH_CONSENT_VERSION,
  newIdempotencyKey = newConsentIdempotencyKey,
}: {
  client: BackendClient;
  participantId: string;
  consentVersion?: string;
  newIdempotencyKey?: () => string;
}) {
  async function load(): Promise<BackendSyncSnapshot> {
    // Read-only: loading the page must not create any backend record.
    const subject = await findOwnSubject(client);
    if (!subject) {
      return { subjectId: null, consent: { status: "none" }, serverRuns: [] };
    }

    const [{ items: consents }, firstPage] = await Promise.all([
      client.listConsents(subject.id),
      client.listActivitySummaries(subject.id, { limit: 50 }),
    ]);
    const granted = activeResearchConsent(consents);

    return {
      subjectId: subject.id,
      consent: granted
        ? { status: "granted", id: granted.id, version: granted.version }
        : { status: "none" },
      serverRuns: firstPage.items
        .filter((summary) => summary.activityCode === "cpt")
        .map((summary) => summaryToCptRun(summary, participantId)),
    };
  }

  /**
   * Explicit, user-initiated grant. Never called implicitly. This is the only
   * place a backend subject is created (first grant only).
   */
  async function grantConsent(): Promise<{ subjectId: string; consent: BackendConsent }> {
    const subject = await ensureOwnSubject(client);
    const consent = await client.createConsent(subject.id, {
      scope: "research",
      version: consentVersion,
      idempotencyKey: newIdempotencyKey(),
    });
    return { subjectId: subject.id, consent };
  }

  async function withdrawConsent(subjectId: string, consentId: string): Promise<BackendConsent> {
    return client.withdrawConsent(subjectId, consentId);
  }

  async function persistRun(run: CptRunSummary): Promise<PersistOutcome> {
    if (run.participantId !== participantId) {
      throw new Error("The activity summary does not belong to the signed-in participant.");
    }

    const result: CptSyncResult = await syncScoredCptRun(client, run);

    if (result.status === "consent-required") {
      throw new ConsentRequiredError();
    }

    return {
      serverRunId: result.summary?.sessionActivityId ?? null,
      message:
        "Saved to the research backend. The server validated the trials and calculated the summary; the trial events are stored there.",
    };
  }

  return { load, grantConsent, withdrawConsent, persistRun };
}

export type BackendSyncController = ReturnType<typeof createBackendSyncController>;
