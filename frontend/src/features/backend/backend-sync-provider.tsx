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
import type { ServerReportView, ServerTwinHistoryEntry, ServerTwinView } from "@/lib/backend/twin";
import type { BackendSession } from "@/lib/backend/types";
import type { CptRunSummary } from "@/types";

export type BackendSyncStatus = "loading" | "ready" | "error";

interface BackendSyncContextValue {
  status: BackendSyncStatus;
  /** User-safe message for the last load failure. */
  loadError: string | null;
  consent: BackendSyncSnapshot["consent"];
  serverRuns: CptRunSummary[];
  /** Server-calculated Digital Twin, version history, reports and sessions. */
  twin: ServerTwinView | null;
  twinHistory: ServerTwinHistoryEntry[];
  reports: ServerReportView[];
  sessions: BackendSession[];
  reportBusy: boolean;
  reportError: string | null;
  createReport: () => Promise<void>;
  /** True while a consent grant or withdrawal is in flight. */
  consentBusy: boolean;
  /** User-safe message for the last consent action failure. */
  consentError: string | null;
  grantConsent: () => Promise<void>;
  withdrawConsent: () => Promise<void>;
  persistRun: (run: CptRunSummary) => Promise<PersistOutcome>;
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

  const value = useMemo<BackendSyncContextValue>(
    () => ({
      status,
      loadError,
      consent: snapshot?.consent ?? NO_CONSENT,
      serverRuns: snapshot?.serverRuns ?? [],
      twin: snapshot?.twin ?? null,
      twinHistory: snapshot?.twinHistory ?? [],
      reports: snapshot?.reports ?? [],
      sessions: snapshot?.sessions ?? [],
      reportBusy,
      reportError,
      createReport,
      consentBusy,
      consentError,
      grantConsent,
      withdrawConsent,
      persistRun,
      refresh,
    }),
    [
      status,
      loadError,
      snapshot,
      reportBusy,
      reportError,
      createReport,
      consentBusy,
      consentError,
      grantConsent,
      withdrawConsent,
      persistRun,
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
