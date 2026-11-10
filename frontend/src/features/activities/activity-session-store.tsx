"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { buildCptRunSummary } from "@/features/activities/cpt/scoring";
import { DEMO_PARTICIPANT_ID } from "@/data/demo/participant";
import type { CptRunSummary, CptTrialEvent } from "@/types";

export interface NewCptRun {
  participantId: string;
  mode: "practice" | "scored";
  events: CptTrialEvent[];
}

/** Optional result of a persistence attempt, used to label and de-duplicate saved runs. */
export interface PersistRunOutcome {
  /** Success message shown to the participant; defaults to the Firebase wording. */
  message?: string;
  /**
   * ID of the server-side run that now represents the browser run. The browser
   * run (which still holds the trial events) is shown instead of this one until
   * the page reloads, so the same run is never listed twice.
   */
  serverRunId?: string | null;
}

const FIREBASE_SAVED_MESSAGE =
  "Activity summary and CPT session metadata were saved to your Firebase account. Trial events were not uploaded.";

interface ActivitySessionContextValue {
  cptRuns: CptRunSummary[];
  participantId: string;
  storageMode: "memory" | "firebase";
  cloudSyncEnabled: boolean;
  canClearCptRuns: boolean;
  persistenceStatus: "not-applicable" | "disabled" | "saving" | "saved" | "failed";
  persistenceMessage: string | null;
  saveCptRun: (input: NewCptRun) => CptRunSummary;
  clearCptRuns: () => void;
  /** Scored runs whose save failed or is waiting (e.g. for consent). */
  unsyncedRunCount: number;
  /** Retries saving every unsynced run, e.g. after consent is granted. */
  retryUnsyncedRuns: () => void;
}

const ActivitySessionContext =
  createContext<ActivitySessionContextValue | null>(null);

export function mergeActivityRuns(
  persistedRuns: readonly CptRunSummary[],
  browserRuns: readonly CptRunSummary[],
  /** Browser run ID -> server run ID, for runs already saved to the backend. */
  serverRunIds: Readonly<Record<string, string>> = {},
): CptRunSummary[] {
  const browserRunById = new Map(browserRuns.map((run) => [run.id, run]));
  // A saved run exists both as a browser run (with trial events) and as a server
  // summary. Show the browser copy and hide the server copy of the same run.
  const shadowedServerIds = new Set(
    Object.entries(serverRunIds)
      .filter(([browserId]) => browserRunById.has(browserId))
      .map(([, serverId]) => serverId),
  );
  const visiblePersistedRuns = persistedRuns.filter((run) => !shadowedServerIds.has(run.id));
  const merged = visiblePersistedRuns.map((persistedRun) => {
    const browserRun = browserRunById.get(persistedRun.id);
    browserRunById.delete(persistedRun.id);

    return browserRun && browserRun.events.length > persistedRun.events.length
      ? browserRun
      : persistedRun;
  });

  merged.push(...browserRunById.values());
  return merged
    .sort(
      (left, right) =>
        new Date(right.completedAt).getTime() -
        new Date(left.completedAt).getTime(),
    )
    .slice(0, 12);
}

export function ActivitySessionProvider({
  children,
  participantId = DEMO_PARTICIPANT_ID,
  storageMode = "memory",
  cloudSyncEnabled = false,
  initialRuns = [],
  onPersistRun,
}: {
  children: ReactNode;
  participantId?: string;
  storageMode?: "memory" | "firebase";
  cloudSyncEnabled?: boolean;
  initialRuns?: CptRunSummary[];
  onPersistRun?: (run: CptRunSummary) => Promise<PersistRunOutcome | void>;
}) {
  const [browserRuns, setBrowserRuns] = useState<CptRunSummary[]>([]);
  const [writeStatus, setWriteStatus] = useState<
    Exclude<ActivitySessionContextValue["persistenceStatus"], "disabled" | "not-applicable">
  >("saved");
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(null);
  const nextSequence = useRef(1);
  const persistenceAttemptedRunIds = useRef(new Set<string>());
  const completedEvents = useRef(new WeakMap<CptTrialEvent[], CptRunSummary>());
  const unsyncedRuns = useRef(new Map<string, CptRunSummary>());
  const [unsyncedRunCount, setUnsyncedRunCount] = useState(0);
  const [serverRunIds, setServerRunIds] = useState<Record<string, string>>({});
  const cptRuns = useMemo(
    () => mergeActivityRuns(initialRuns, browserRuns, serverRunIds),
    [browserRuns, initialRuns, serverRunIds],
  );
  const persistenceStatus: ActivitySessionContextValue["persistenceStatus"] =
    storageMode !== "firebase"
      ? "not-applicable"
      : !cloudSyncEnabled
        ? "disabled"
        : writeStatus;

  const attemptPersist = useCallback(
    (run: CptRunSummary) => {
      if (!onPersistRun) return;
      setWriteStatus("saving");
      setPersistenceMessage(null);
      void onPersistRun(run)
        .then((outcome) => {
          unsyncedRuns.current.delete(run.id);
          setUnsyncedRunCount(unsyncedRuns.current.size);
          const serverRunId = outcome?.serverRunId;
          if (serverRunId) {
            setServerRunIds((current) => ({ ...current, [run.id]: serverRunId }));
          }
          setWriteStatus("saved");
          setPersistenceMessage(outcome?.message ?? FIREBASE_SAVED_MESSAGE);
        })
        .catch((error: unknown) => {
          unsyncedRuns.current.set(run.id, run);
          setUnsyncedRunCount(unsyncedRuns.current.size);
          setWriteStatus("failed");
          setPersistenceMessage(
            error instanceof Error
              ? error.message
              : "Cloud synchronization failed. This summary remains only in the current browser session.",
          );
        });
    },
    [onPersistRun],
  );

  const retryUnsyncedRuns = useCallback(() => {
    for (const run of [...unsyncedRuns.current.values()]) {
      attemptPersist(run);
    }
  }, [attemptPersist]);

  const saveCptRun = useCallback((input: NewCptRun) => {
    const completed = completedEvents.current.get(input.events);
    if (completed) return completed;
    const sequence = nextSequence.current;
    nextSequence.current += 1;

    const id =
      storageMode === "firebase"
        ? globalThis.crypto.randomUUID()
        : `DEMO-CPT-${String(sequence).padStart(4, "0")}`;
    const run = buildCptRunSummary({
      id,
      participantId,
      mode: input.mode,
      completedAt: new Date().toISOString(),
      events: input.events,
    });
    completedEvents.current.set(input.events, run);

    setBrowserRuns((current) => [run, ...current].slice(0, 12));

    if (storageMode === "firebase" && input.mode === "scored") {
      if (cloudSyncEnabled && onPersistRun && !persistenceAttemptedRunIds.current.has(run.id)) {
        persistenceAttemptedRunIds.current.add(run.id);
        attemptPersist(run);
      }
    }

    return run;
  }, [attemptPersist, cloudSyncEnabled, onPersistRun, participantId, storageMode]);

  const clearCptRuns = useCallback(() => {
    if (storageMode === "memory") {
      setBrowserRuns([]);
    }
  }, [storageMode]);

  const value = useMemo(
    () => ({
      cptRuns,
      participantId,
      storageMode,
      cloudSyncEnabled,
      canClearCptRuns: storageMode === "memory",
      persistenceStatus,
      persistenceMessage,
      saveCptRun,
      clearCptRuns,
      unsyncedRunCount,
      retryUnsyncedRuns,
    }),
    [
      cptRuns,
      participantId,
      storageMode,
      cloudSyncEnabled,
      persistenceStatus,
      persistenceMessage,
      saveCptRun,
      clearCptRuns,
      unsyncedRunCount,
      retryUnsyncedRuns,
    ],
  );

  return (
    <ActivitySessionContext.Provider value={value}>
      {children}
    </ActivitySessionContext.Provider>
  );
}

export function useActivitySessions(): ActivitySessionContextValue {
  const context = useContext(ActivitySessionContext);

  if (!context) {
    throw new Error(
      "useActivitySessions must be used within ActivitySessionProvider.",
    );
  }

  return context;
}
