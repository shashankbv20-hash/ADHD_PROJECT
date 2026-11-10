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
import {
  parseServerReport,
  parseServerTwin,
  parseTwinHistory,
  type ServerReportView,
  type ServerTwinHistoryEntry,
  type ServerTwinView,
} from "@/lib/backend/twin";
import type { BackendConsent, BackendSession } from "@/lib/backend/types";
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
  /** Server-side Digital Twin (null until a subject exists). */
  twin: ServerTwinView | null;
  twinHistory: ServerTwinHistoryEntry[];
  reports: ServerReportView[];
  sessions: BackendSession[];
}

const EMPTY_SNAPSHOT: BackendSyncSnapshot = {
  subjectId: null,
  consent: { status: "none" },
  serverRuns: [],
  twin: null,
  twinHistory: [],
  reports: [],
  sessions: [],
};

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
    if (error.backendCode === "report_insufficient_data") {
      return "There are no saved runs to include in a report yet.";
    }
    if (error.backendCode === "consent_required") {
      return "Research consent is required for this. Grant consent on this page first.";
    }
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
      return EMPTY_SNAPSHOT;
    }

    const [{ items: consents }, firstPage, twin, history, reports, sessions] = await Promise.all([
      client.listConsents(subject.id),
      client.listActivitySummaries(subject.id, { limit: 50 }),
      client.getDigitalTwin(subject.id),
      client.listDigitalTwinHistory(subject.id),
      client.listReports(subject.id),
      client.listSessions(subject.id, { limit: 50 }),
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
      twin: parseServerTwin(twin),
      twinHistory: parseTwinHistory(history.items),
      reports: reports.items.map(parseServerReport),
      sessions: sessions.items,
    };
  }

  /**
   * Explicit, user-initiated report over all saved summaries. The key is derived
   * from the number of saved runs, so pressing the button twice for the same data
   * returns the same report instead of creating a duplicate.
   */
  async function createReport(subjectId: string, savedRunCount: number): Promise<ServerReportView> {
    const report = await client.createReport(subjectId, {
      idempotencyKey: `report-${subjectId}-${savedRunCount}`,
    });
    return parseServerReport(report);
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

  return { load, grantConsent, withdrawConsent, persistRun, createReport };
}

export type BackendSyncController = ReturnType<typeof createBackendSyncController>;
