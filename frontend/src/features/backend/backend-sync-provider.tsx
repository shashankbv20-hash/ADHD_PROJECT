"use client";

import type { User } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createBackendClient } from "@/lib/backend/client";
import {
  createBackendSyncController,
  describeSyncError,
  type BackendSyncSnapshot,
  type PersistOutcome,
} from "@/lib/backend/sync-controller";
import type { AccessLogEntry } from "@/lib/backend/audit";
import type { CaregiverShare } from "@/lib/backend/caregiver";
import type { ServerReportView, ServerTwinHistoryEntry, ServerTwinView } from "@/lib/backend/twin";
import type { BackendSession, DataErasureResult } from "@/lib/backend/types";
import type {
  GoNoGoRunView,
  NBackRunView,
  StopSignalRunView,
  StroopRunView,
  TaskSwitchingRunView,
  VisualSearchRunView,
  PlanningPuzzleRunView,
  VisualSequenceRunView,
  TimePerceptionRunView,
  ObjectTrackingRunView,
} from "@/lib/backend/summary-mapping";
import type {
  BackendStopSignalEvent,
  BackendStroopEvent,
  BackendTaskSwitchingEvent,
  BackendVisualSearchEvent,
  BackendPlanningPuzzleEvent,
  BackendVisualSequenceEvent,
  BackendTimePerceptionEvent,
  BackendObjectTrackingEvent,
} from "@/lib/backend/types";
import type { CptRunSummary, CptTrialEvent } from "@/types";

export type BackendSyncStatus = "loading" | "ready" | "error";

interface BackendSyncContextValue {
  status: BackendSyncStatus;
  /** User-safe message for the last load failure. */
  loadError: string | null;
  consent: BackendSyncSnapshot["consent"];
  serverRuns: CptRunSummary[];
  /** Server-calculated Digital Twin, version history, reports and sessions. */
  /** Saved Go/No-Go runs, newest first. */
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
  twin: ServerTwinView | null;
  twinHistory: ServerTwinHistoryEntry[];
  reports: ServerReportView[];
  sessions: BackendSession[];
  /** True when older runs or sessions exist beyond the page cap. */
  truncated: boolean;
  reportBusy: boolean;
  reportError: string | null;
  createReport: () => Promise<void>;
  /** Downloads a saved report as a PDF. Throws an Error with user-safe wording on failure. */
  downloadReportPdf: (reportId: string) => Promise<{ filename: string; blob: Blob }>;
  /** Null until the participant first grants consent (nothing exists to export or erase). */
  subjectId: string | null;
  /** Data rights. Each throws an Error with user-safe wording on failure. */
  exportData: () => Promise<{ filename: string; json: string }>;
  loadAccessLog: () => Promise<AccessLogEntry[]>;
  /** Irreversible; the caller must have collected the typed confirmation first. */
  eraseData: () => Promise<DataErasureResult>;
  /** Caregiver sharing (owner only). Each throws an Error with user-safe wording on failure. */
  listCaregivers: () => Promise<CaregiverShare[]>;
  shareWithCaregiver: (caregiverId: string) => Promise<CaregiverShare>;
  stopSharing: (relationshipId: string) => Promise<CaregiverShare>;
  /** True while a consent grant or withdrawal is in flight. */
  consentBusy: boolean;
  /** User-safe message for the last consent action failure. */
  consentError: string | null;
  grantConsent: () => Promise<void>;
  withdrawConsent: () => Promise<void>;
  persistRun: (run: CptRunSummary) => Promise<PersistOutcome>;
  /** Saves a scored Go/No-Go run through the API. Throws an Error with user-safe wording. */
  persistGoNoGoRun: (runId: string, events: readonly CptTrialEvent[]) => Promise<PersistOutcome>;
  /** Saves a scored N-back run through the API. Throws an Error with user-safe wording. */
  persistNBackRun: (runId: string, events: readonly CptTrialEvent[]) => Promise<PersistOutcome>;
  /** Saves a scored Time Perception run through the API. Throws an Error with user-safe wording. */
  persistTimePerceptionRun: (
    runId: string,
    events: readonly BackendTimePerceptionEvent[],
  ) => Promise<PersistOutcome>;
  /** Saves a scored Multiple Object Tracking run through the API. Throws an Error with user-safe wording. */
  persistObjectTrackingRun: (
    runId: string,
    events: readonly BackendObjectTrackingEvent[],
  ) => Promise<PersistOutcome>;
  /** Saves a scored Visual Sequence run through the API. Throws an Error with user-safe wording. */
  persistVisualSequenceRun: (
    runId: string,
    events: readonly BackendVisualSequenceEvent[],
  ) => Promise<PersistOutcome>;
  /** Saves a scored Planning Puzzle run through the API. Throws an Error with user-safe wording. */
  persistPlanningPuzzleRun: (
    runId: string,
    events: readonly BackendPlanningPuzzleEvent[],
  ) => Promise<PersistOutcome>;
  /** Saves a scored Visual Search run through the API. Throws an Error with user-safe wording. */
  persistVisualSearchRun: (
    runId: string,
    events: readonly BackendVisualSearchEvent[],
  ) => Promise<PersistOutcome>;
  /** Saves a scored Task Switching run through the API. Throws an Error with user-safe wording. */
  persistTaskSwitchingRun: (
    runId: string,
    events: readonly BackendTaskSwitchingEvent[],
  ) => Promise<PersistOutcome>;
  /** Saves a scored Stroop run through the API. Throws an Error with user-safe wording. */
  persistStroopRun: (runId: string, events: readonly BackendStroopEvent[]) => Promise<PersistOutcome>;
  /** Saves a scored Stop-Signal run through the API. Throws an Error with user-safe wording. */
  persistStopSignalRun: (
    runId: string,
    events: readonly BackendStopSignalEvent[],
  ) => Promise<PersistOutcome>;
  refresh: () => Promise<void>;
}

const BackendSyncContext = createContext<BackendSyncContextValue | null>(null);

const NO_CONSENT: BackendSyncSnapshot["consent"] = { status: "none" };

/**
 * Connects a signed-in Firebase user to the FastAPI backend: loads consent
 * state and server-calculated runs, and exposes explicit consent actions and
 * run persistence. Nothing is written on load; consent is never granted
 * implicitly.
 */
export function BackendSyncProvider({
  user,
  baseUrl,
  children,
}: {
  user: User;
  baseUrl: string;
  children: ReactNode;
}) {
  const controller = useMemo(
    () =>
      createBackendSyncController({
        client: createBackendClient({
          baseUrl,
          getIdToken: (forceRefresh) => user.getIdToken(forceRefresh),
        }),
        participantId: user.uid,
      }),
    [baseUrl, user],
  );

  const [snapshot, setSnapshot] = useState<BackendSyncSnapshot | null>(null);
  const [status, setStatus] = useState<BackendSyncStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const loadVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = (loadVersion.current += 1);

    try {
      const next = await controller.load();
      if (version === loadVersion.current) {
        setSnapshot(next);
        setStatus("ready");
        setLoadError(null);
      }
    } catch (error) {
      if (version === loadVersion.current) {
        setStatus("error");
        setLoadError(describeSyncError(error));
      }
    }
  }, [controller]);

  useEffect(() => {
    // Loading remote state on mount is the purpose of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    return () => {
      loadVersion.current += 1;
    };
  }, [refresh]);

  const grantConsent = useCallback(async () => {
    setConsentBusy(true);
    setConsentError(null);

    try {
      await controller.grantConsent();
      await refresh();
    } catch (error) {
      setConsentError(describeSyncError(error));
    } finally {
      setConsentBusy(false);
    }
  }, [controller, refresh]);

  const withdrawConsent = useCallback(async () => {
    const current = snapshot;
    if (!current || current.consent.status !== "granted" || !current.subjectId) {
      return;
    }

    setConsentBusy(true);
    setConsentError(null);

    try {
      await controller.withdrawConsent(current.subjectId, current.consent.id);
      await refresh();
    } catch (error) {
      setConsentError(describeSyncError(error));
    } finally {
      setConsentBusy(false);
    }
  }, [controller, refresh, snapshot]);

  const createReport = useCallback(async () => {
    const current = snapshot;
    if (!current?.subjectId || current.serverRuns.length === 0) {
      return;
    }

    setReportBusy(true);
    setReportError(null);

    try {
      await controller.createReport(current.subjectId, current.serverRuns.length);
      await refresh();
    } catch (error) {
      setReportError(describeSyncError(error));
    } finally {
      setReportBusy(false);
    }
  }, [controller, refresh, snapshot]);

  const subjectId = snapshot?.subjectId ?? null;

  const downloadReportPdf = useCallback(
    async (reportId: string) => {
      if (!subjectId) {
        throw new Error("There is no saved report to download yet.");
      }

      try {
        return await controller.downloadReportPdf(subjectId, reportId);
      } catch (error) {
        throw new Error(describeSyncError(error), { cause: error });
      }
    },
    [controller, subjectId],
  );

  const exportData = useCallback(async () => {
    if (!subjectId) {
      throw new Error("There is no saved data to export yet.");
    }

    try {
      return await controller.exportData(subjectId);
    } catch (error) {
      throw new Error(describeSyncError(error), { cause: error });
    }
  }, [controller, subjectId]);

  const loadAccessLog = useCallback(async () => {
    if (!subjectId) {
      return [];
    }

    try {
      return await controller.loadAccessLog(subjectId);
    } catch (error) {
      throw new Error(describeSyncError(error), { cause: error });
    }
  }, [controller, subjectId]);

  const eraseData = useCallback(async () => {
    if (!subjectId) {
      throw new Error("There is no saved data to erase yet.");
    }

    let result: DataErasureResult;

    try {
      result = await controller.eraseData(subjectId);
    } catch (error) {
      throw new Error(describeSyncError(error), { cause: error });
    }

    // Consent is now withdrawn and server data is gone: reload what the screens show.
    await refresh();
    return result;
  }, [controller, refresh, subjectId]);

  const listCaregivers = useCallback(async () => {
    if (!subjectId) {
      return [];
    }

    try {
      return await controller.sharing.list(subjectId);
    } catch (error) {
      throw new Error(describeSyncError(error), { cause: error });
    }
  }, [controller, subjectId]);

  const shareWithCaregiver = useCallback(
    async (caregiverId: string) => {
      if (!subjectId) {
        throw new Error("Grant research consent first; there is nothing to share yet.");
      }

      try {
        return await controller.sharing.share(subjectId, caregiverId);
      } catch (error) {
        throw new Error(describeSyncError(error), { cause: error });
      }
    },
    [controller, subjectId],
  );

  const stopSharing = useCallback(
    async (relationshipId: string) => {
      if (!subjectId) {
        throw new Error("There is nothing shared yet.");
      }

      try {
        return await controller.sharing.stop(subjectId, relationshipId);
      } catch (error) {
        throw new Error(describeSyncError(error), { cause: error });
      }
    },
    [controller, subjectId],
  );

  const persistRun = useCallback(
    async (run: CptRunSummary) => {
      let outcome: PersistOutcome;

      try {
        outcome = await controller.persistRun(run);
      } catch (error) {
        // Surface only vetted wording, never raw server text.
        throw new Error(describeSyncError(error), { cause: error });
      }

      void refresh();
      return outcome;
    },
    [controller, refresh],
  );

  const persistGoNoGoRun = useCallback(
    async (runId: string, events: readonly CptTrialEvent[]) => {
      try {
        const outcome = await controller.persistGoNoGoRun(runId, events);
        void refresh();
        return outcome;
      } catch (error) {
        throw new Error(describeSyncError(error), { cause: error });
      }
    },
    [controller, refresh],
  );

  const persistNBackRun = useCallback(
    async (runId: string, events: readonly CptTrialEvent[]) => {
      try {
        const outcome = await controller.persistNBackRun(runId, events);
        void refresh();
        return outcome;
      } catch (error) {
        throw new Error(describeSyncError(error), { cause: error });
      }
    },
    [controller, refresh],
  );

  const persistTimePerceptionRun = useCallback(
    async (runId: string, events: readonly BackendTimePerceptionEvent[]) => {
      try {
        const outcome = await controller.persistTimePerceptionRun(runId, events);
        void refresh();
        return outcome;
      } catch (error) {
        throw new Error(describeSyncError(error), { cause: error });
      }
    },
    [controller, refresh],
  );

  const persistObjectTrackingRun = useCallback(
    async (runId: string, events: readonly BackendObjectTrackingEvent[]) => {
      try {
        const outcome = await controller.persistObjectTrackingRun(runId, events);
        void refresh();
        return outcome;
      } catch (error) {
        throw new Error(describeSyncError(error), { cause: error });
      }
    },
    [controller, refresh],
  );

  const persistVisualSequenceRun = useCallback(
    async (runId: string, events: readonly BackendVisualSequenceEvent[]) => {
      try {
        const outcome = await controller.persistVisualSequenceRun(runId, events);
        void refresh();
        return outcome;
      } catch (error) {
        throw new Error(describeSyncError(error), { cause: error });
      }
    },
    [controller, refresh],
  );

  const persistPlanningPuzzleRun = useCallback(
    async (runId: string, events: readonly BackendPlanningPuzzleEvent[]) => {
      try {
        const outcome = await controller.persistPlanningPuzzleRun(runId, events);
        void refresh();
        return outcome;
      } catch (error) {
        throw new Error(describeSyncError(error), { cause: error });
      }
    },
    [controller, refresh],
  );

  const persistVisualSearchRun = useCallback(
    async (runId: string, events: readonly BackendVisualSearchEvent[]) => {
      try {
        const outcome = await controller.persistVisualSearchRun(runId, events);
        void refresh();
        return outcome;
      } catch (error) {
        throw new Error(describeSyncError(error), { cause: error });
      }
    },
    [controller, refresh],
  );

  const persistTaskSwitchingRun = useCallback(
    async (runId: string, events: readonly BackendTaskSwitchingEvent[]) => {
      try {
        const outcome = await controller.persistTaskSwitchingRun(runId, events);
        void refresh();
        return outcome;
      } catch (error) {
        throw new Error(describeSyncError(error), { cause: error });
      }
    },
    [controller, refresh],
  );

  const persistStroopRun = useCallback(
    async (runId: string, events: readonly BackendStroopEvent[]) => {
      try {
        const outcome = await controller.persistStroopRun(runId, events);
        void refresh();
        return outcome;
      } catch (error) {
        throw new Error(describeSyncError(error), { cause: error });
      }
    },
    [controller, refresh],
  );

  const persistStopSignalRun = useCallback(
    async (runId: string, events: readonly BackendStopSignalEvent[]) => {
      try {
        const outcome = await controller.persistStopSignalRun(runId, events);
        void refresh();
        return outcome;
      } catch (error) {
        throw new Error(describeSyncError(error), { cause: error });
      }
    },
    [controller, refresh],
  );

  const value = useMemo<BackendSyncContextValue>(
    () => ({
      status,
      loadError,
      consent: snapshot?.consent ?? NO_CONSENT,
      serverRuns: snapshot?.serverRuns ?? [],
      goNoGoRuns: snapshot?.goNoGoRuns ?? [],
      nBackRuns: snapshot?.nBackRuns ?? [],
      stopSignalRuns: snapshot?.stopSignalRuns ?? [],
      stroopRuns: snapshot?.stroopRuns ?? [],
      taskSwitchingRuns: snapshot?.taskSwitchingRuns ?? [],
      visualSearchRuns: snapshot?.visualSearchRuns ?? [],
      planningPuzzleRuns: snapshot?.planningPuzzleRuns ?? [],
      visualSequenceRuns: snapshot?.visualSequenceRuns ?? [],
      timePerceptionRuns: snapshot?.timePerceptionRuns ?? [],
      objectTrackingRuns: snapshot?.objectTrackingRuns ?? [],
      twin: snapshot?.twin ?? null,
      twinHistory: snapshot?.twinHistory ?? [],
      reports: snapshot?.reports ?? [],
      sessions: snapshot?.sessions ?? [],
      truncated: snapshot?.truncated ?? false,
      reportBusy,
      reportError,
      createReport,
      downloadReportPdf,
      subjectId,
      exportData,
      loadAccessLog,
      eraseData,
      listCaregivers,
      shareWithCaregiver,
      stopSharing,
      consentBusy,
      consentError,
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
      refresh,
    }),
    [
      status,
      loadError,
      snapshot,
      reportBusy,
      reportError,
      createReport,
      downloadReportPdf,
      subjectId,
      exportData,
      loadAccessLog,
      eraseData,
      listCaregivers,
      shareWithCaregiver,
      stopSharing,
      consentBusy,
      consentError,
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
      refresh,
    ],
  );

  return <BackendSyncContext.Provider value={value}>{children}</BackendSyncContext.Provider>;
}

export function useBackendSync(): BackendSyncContextValue {
  const context = useContext(BackendSyncContext);

  if (!context) {
    throw new Error("useBackendSync must be used within BackendSyncProvider.");
  }

  return context;
}

/** For components that render in both Firebase-only and API-backed modes. */
export function useOptionalBackendSync(): BackendSyncContextValue | null {
  return useContext(BackendSyncContext);
}
