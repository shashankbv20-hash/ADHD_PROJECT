import { ApiClientError } from "@/lib/api-client";
import type { BackendClient } from "@/lib/backend/client";
import {
  RESEARCH_CONSENT_VERSION,
  newConsentIdempotencyKey,
} from "@/lib/backend/consent";
import {
  ensureOwnSubject,
  eventsToBackend,
  findOwnSubject,
  syncScoredActivity,
  syncScoredCptRun,
  type CptSyncResult,
} from "@/lib/backend/cpt-sync";
import { exportFilename, parseAuditEvent, type AccessLogEntry } from "@/lib/backend/audit";
import { createCaregiverSharing } from "@/lib/backend/caregiver";
import { fetchAllPages, PAGE_SIZE } from "@/lib/backend/paging";
import {
  summaryToCptRun,
  summaryToGoNoGoRun,
  summaryToNBackRun,
  summaryToStopSignalRun,
  summaryToStroopRun,
  summaryToTaskSwitchingRun,
  summaryToVisualSearchRun,
  summaryToPlanningPuzzleRun,
  summaryToVisualSequenceRun,
  summaryToTimePerceptionRun,
  summaryToObjectTrackingRun,
  type GoNoGoRunView,
  type NBackRunView,
  type StopSignalRunView,
  type StroopRunView,
  type TaskSwitchingRunView,
  type VisualSearchRunView,
  type PlanningPuzzleRunView,
  type VisualSequenceRunView,
  type TimePerceptionRunView,
  type ObjectTrackingRunView,
} from "@/lib/backend/summary-mapping";
import {
  parseServerReport,
  parseServerTwin,
  parseTwinHistory,
  type ServerReportView,
  type ServerTwinHistoryEntry,
  type ServerTwinView,
} from "@/lib/backend/twin";
import type {
  BackendConsent,
  BackendSession,
  BackendStopSignalEvent,
  BackendStroopEvent,
  BackendTaskSwitchingEvent,
  BackendVisualSearchEvent,
  BackendPlanningPuzzleEvent,
  BackendVisualSequenceEvent,
  BackendTimePerceptionEvent,
  BackendObjectTrackingEvent,
  DataErasureResult,
} from "@/lib/backend/types";
import type { CptRunSummary, CptTrialEvent } from "@/types";

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
  /** Saved Go/No-Go runs, newest first (kept apart from the CPT-based Twin). */
  goNoGoRuns: GoNoGoRunView[];
  /** Saved N-back runs, newest first. */
  nBackRuns: NBackRunView[];
  /** Saved Stop-Signal runs, newest first. */
  stopSignalRuns: StopSignalRunView[];
  /** Saved Stroop runs, newest first. */
  stroopRuns: StroopRunView[];
  /** Saved Task Switching runs, newest first. */
  taskSwitchingRuns: TaskSwitchingRunView[];
  /** Saved Visual Search runs, newest first. */
  visualSearchRuns: VisualSearchRunView[];
  /** Saved Planning Puzzle runs, newest first. */
  planningPuzzleRuns: PlanningPuzzleRunView[];
  /** Saved Visual Sequence runs, newest first. */
  visualSequenceRuns: VisualSequenceRunView[];
  /** Saved Time Perception runs, newest first. */
  timePerceptionRuns: TimePerceptionRunView[];
  /** Saved Multiple Object Tracking runs, newest first. */
  objectTrackingRuns: ObjectTrackingRunView[];
  /** Server-side Digital Twin (null until a subject exists). */
  twin: ServerTwinView | null;
  twinHistory: ServerTwinHistoryEntry[];
  reports: ServerReportView[];
  sessions: BackendSession[];
  /** True when the page cap was hit, so older runs or sessions exist that are not shown. */
  truncated: boolean;
}

const EMPTY_SNAPSHOT: BackendSyncSnapshot = {
  subjectId: null,
  consent: { status: "none" },
  serverRuns: [],
  goNoGoRuns: [],
  nBackRuns: [],
  stopSignalRuns: [],
  stroopRuns: [],
  taskSwitchingRuns: [],
  visualSearchRuns: [],
  planningPuzzleRuns: [],
  visualSequenceRuns: [],
  timePerceptionRuns: [],
  objectTrackingRuns: [],
  twin: null,
  twinHistory: [],
  reports: [],
  sessions: [],
  truncated: false,
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
    if (error.backendCode === "caregiver_not_found") {
      return "No caregiver account matches that ID. Ask the caregiver to copy it from their own Caregiver page.";
    }
    if (error.backendCode === "caregiver_role_required") {
      return "This account does not have the caregiver role.";
    }
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

    const [{ items: consents }, summaries, twin, history, reports, sessions] = await Promise.all([
      client.listConsents(subject.id),
      fetchAllPages((cursor) =>
        client.listActivitySummaries(subject.id, { limit: PAGE_SIZE, cursor }),
      ),
      client.getDigitalTwin(subject.id),
      client.listDigitalTwinHistory(subject.id),
      client.listReports(subject.id),
      fetchAllPages((cursor) => client.listSessions(subject.id, { limit: PAGE_SIZE, cursor })),
    ]);
    const granted = activeResearchConsent(consents);

    return {
      subjectId: subject.id,
      consent: granted
        ? { status: "granted", id: granted.id, version: granted.version }
        : { status: "none" },
      serverRuns: summaries.items
        .filter((summary) => summary.activityCode === "cpt")
        .map((summary) => summaryToCptRun(summary, participantId)),
      goNoGoRuns: summaries.items
        .filter((summary) => summary.activityCode === "go-no-go")
        .map(summaryToGoNoGoRun)
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt)),
      nBackRuns: summaries.items
        .filter((summary) => summary.activityCode === "n-back")
        .map(summaryToNBackRun)
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt)),
      timePerceptionRuns: summaries.items
        .filter((summary) => summary.activityCode === "time-perception")
        .map(summaryToTimePerceptionRun)
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt)),
      objectTrackingRuns: summaries.items
        .filter((summary) => summary.activityCode === "multiple-object-tracking")
        .map(summaryToObjectTrackingRun)
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt)),
      visualSequenceRuns: summaries.items
        .filter((summary) => summary.activityCode === "visual-sequence")
        .map(summaryToVisualSequenceRun)
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt)),
      planningPuzzleRuns: summaries.items
        .filter((summary) => summary.activityCode === "planning-puzzle")
        .map(summaryToPlanningPuzzleRun)
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt)),
      visualSearchRuns: summaries.items
        .filter((summary) => summary.activityCode === "visual-search")
        .map(summaryToVisualSearchRun)
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt)),
      taskSwitchingRuns: summaries.items
        .filter((summary) => summary.activityCode === "task-switching")
        .map(summaryToTaskSwitchingRun)
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt)),
      stroopRuns: summaries.items
        .filter((summary) => summary.activityCode === "stroop")
        .map(summaryToStroopRun)
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt)),
      stopSignalRuns: summaries.items
        .filter((summary) => summary.activityCode === "stop-signal")
        .map(summaryToStopSignalRun)
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt)),
      twin: parseServerTwin(twin),
      twinHistory: parseTwinHistory(history.items),
      reports: reports.items.map(parseServerReport),
      sessions: sessions.items,
      truncated: summaries.truncated || sessions.truncated,
    };
  }

  /**
   * Explicit, user-initiated report over all saved summaries. The key is derived
   * from the number of saved runs, so pressing the button twice for the same data
   * returns the same report instead of creating a duplicate.
   */
  async function downloadReportPdf(
    subjectId: string,
    reportId: string,
  ): Promise<{ filename: string; blob: Blob }> {
    const blob = await client.downloadReportPdf(subjectId, reportId);
    return { filename: `attune-report-${reportId.slice(0, 8)}.pdf`, blob };
  }

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

  /** Saves one scored Go/No-Go run; the server validates the trials and calculates the summary. */
  async function persistGoNoGoRun(
    runId: string,
    events: readonly CptTrialEvent[],
  ): Promise<PersistOutcome> {
    const result = await syncScoredActivity(client, {
      activityCode: "go-no-go",
      idempotencyKey: `go-no-go-run-${runId}`,
      events: eventsToBackend(events),
    });

    if (result.status === "consent-required") {
      throw new ConsentRequiredError();
    }

    return {
      serverRunId: result.summary?.sessionActivityId ?? null,
      message:
        "Saved to the research backend. The server validated the trials and calculated the summary.",
    };
  }

  /** Saves one scored N-back run; the server validates the trials and calculates the summary. */
  async function persistNBackRun(
    runId: string,
    events: readonly CptTrialEvent[],
  ): Promise<PersistOutcome> {
    const result = await syncScoredActivity(client, {
      activityCode: "n-back",
      idempotencyKey: `n-back-run-${runId}`,
      events: eventsToBackend(events),
    });

    if (result.status === "consent-required") {
      throw new ConsentRequiredError();
    }

    return {
      serverRunId: result.summary?.sessionActivityId ?? null,
      message:
        "Saved to the research backend. The server validated the trials and calculated the summary.",
    };
  }

  /** Saves one scored Time Perception run; the server checks the durations and calculates the summary. */
  async function persistTimePerceptionRun(
    runId: string,
    events: readonly BackendTimePerceptionEvent[],
  ): Promise<PersistOutcome> {
    const result = await syncScoredActivity(client, {
      activityCode: "time-perception",
      idempotencyKey: `time-perception-run-${runId}`,
      events: [...events],
    });

    if (result.status === "consent-required") {
      throw new ConsentRequiredError();
    }

    return {
      serverRunId: result.summary?.sessionActivityId ?? null,
      message:
        "Saved to the research backend. The server checked the trials and calculated the summary.",
    };
  }

  /** Saves one scored Multiple Object Tracking run; the server checks the picks and calculates the summary. */
  async function persistObjectTrackingRun(
    runId: string,
    events: readonly BackendObjectTrackingEvent[],
  ): Promise<PersistOutcome> {
    const result = await syncScoredActivity(client, {
      activityCode: "multiple-object-tracking",
      idempotencyKey: `multiple-object-tracking-run-${runId}`,
      events: [...events],
    });

    if (result.status === "consent-required") {
      throw new ConsentRequiredError();
    }

    return {
      serverRunId: result.summary?.sessionActivityId ?? null,
      message:
        "Saved to the research backend. The server checked the trials and calculated the summary.",
    };
  }

  /** Saves one scored Visual Sequence run; the server checks the answers and calculates the summary. */
  async function persistVisualSequenceRun(
    runId: string,
    events: readonly BackendVisualSequenceEvent[],
  ): Promise<PersistOutcome> {
    const result = await syncScoredActivity(client, {
      activityCode: "visual-sequence",
      idempotencyKey: `visual-sequence-run-${runId}`,
      events: [...events],
    });

    if (result.status === "consent-required") {
      throw new ConsentRequiredError();
    }

    return {
      serverRunId: result.summary?.sessionActivityId ?? null,
      message:
        "Saved to the research backend. The server checked the answers and calculated the summary.",
    };
  }

  /** Saves one scored Planning Puzzle run; the server replays the moves and calculates the summary. */
  async function persistPlanningPuzzleRun(
    runId: string,
    events: readonly BackendPlanningPuzzleEvent[],
  ): Promise<PersistOutcome> {
    const result = await syncScoredActivity(client, {
      activityCode: "planning-puzzle",
      idempotencyKey: `planning-puzzle-run-${runId}`,
      events: [...events],
    });

    if (result.status === "consent-required") {
      throw new ConsentRequiredError();
    }

    return {
      serverRunId: result.summary?.sessionActivityId ?? null,
      message:
        "Saved to the research backend. The server replayed the moves and calculated the summary.",
    };
  }

  /** Saves one scored Visual Search run; the server validates the trials and calculates the summary. */
  async function persistVisualSearchRun(
    runId: string,
    events: readonly BackendVisualSearchEvent[],
  ): Promise<PersistOutcome> {
    const result = await syncScoredActivity(client, {
      activityCode: "visual-search",
      idempotencyKey: `visual-search-run-${runId}`,
      events: [...events],
    });

    if (result.status === "consent-required") {
      throw new ConsentRequiredError();
    }

    return {
      serverRunId: result.summary?.sessionActivityId ?? null,
      message:
        "Saved to the research backend. The server validated the trials and calculated the summary.",
    };
  }

  /** Saves one scored Task Switching run; the server validates the trials and calculates the summary. */
  async function persistTaskSwitchingRun(
    runId: string,
    events: readonly BackendTaskSwitchingEvent[],
  ): Promise<PersistOutcome> {
    const result = await syncScoredActivity(client, {
      activityCode: "task-switching",
      idempotencyKey: `task-switching-run-${runId}`,
      events: [...events],
    });

    if (result.status === "consent-required") {
      throw new ConsentRequiredError();
    }

    return {
      serverRunId: result.summary?.sessionActivityId ?? null,
      message:
        "Saved to the research backend. The server validated the trials and calculated the summary.",
    };
  }

  /** Saves one scored Stroop run; the server validates the trials and calculates the summary. */
  async function persistStroopRun(
    runId: string,
    events: readonly BackendStroopEvent[],
  ): Promise<PersistOutcome> {
    const result = await syncScoredActivity(client, {
      activityCode: "stroop",
      idempotencyKey: `stroop-run-${runId}`,
      events: [...events],
    });

    if (result.status === "consent-required") {
      throw new ConsentRequiredError();
    }

    return {
      serverRunId: result.summary?.sessionActivityId ?? null,
      message:
        "Saved to the research backend. The server validated the trials and calculated the summary.",
    };
  }

  /** Saves one scored Stop-Signal run; the server validates the trials and calculates the summary. */
  async function persistStopSignalRun(
    runId: string,
    events: readonly BackendStopSignalEvent[],
  ): Promise<PersistOutcome> {
    const result = await syncScoredActivity(client, {
      activityCode: "stop-signal",
      idempotencyKey: `stop-signal-run-${runId}`,
      events: [...events],
    });

    if (result.status === "consent-required") {
      throw new ConsentRequiredError();
    }

    return {
      serverRunId: result.summary?.sessionActivityId ?? null,
      message:
        "Saved to the research backend. The server validated the trials and calculated the summary.",
    };
  }

  /** Everything stored for this subject, serialized for download. Owner only. */
  async function exportData(
    subjectId: string,
    now: Date = new Date(),
  ): Promise<{ filename: string; json: string }> {
    const bundle = await client.exportSubjectData(subjectId);
    return { filename: exportFilename(now), json: JSON.stringify(bundle, null, 2) };
  }

  async function loadAccessLog(subjectId: string): Promise<AccessLogEntry[]> {
    const { items } = await client.listAuditEvents(subjectId, { limit: 200 });
    return items.map(parseAuditEvent);
  }

  /**
   * Irreversible. Withdraws consent and deletes the subject's research data on the
   * backend. The caller must have obtained the participant's typed confirmation.
   */
  async function eraseData(subjectId: string): Promise<DataErasureResult> {
    return client.eraseSubjectData(subjectId);
  }

  const sharing = createCaregiverSharing(client);

  return {
    sharing,
    load,
    grantConsent,
    withdrawConsent,
    persistRun,
    persistGoNoGoRun,
    persistNBackRun,
    persistTimePerceptionRun,
    persistObjectTrackingRun,
    persistVisualSequenceRun,
    persistPlanningPuzzleRun,
    persistVisualSearchRun,
    persistTaskSwitchingRun,
    persistStroopRun,
    persistStopSignalRun,
    createReport,
    downloadReportPdf,
    exportData,
    loadAccessLog,
    eraseData,
  };
}

export type BackendSyncController = ReturnType<typeof createBackendSyncController>;
