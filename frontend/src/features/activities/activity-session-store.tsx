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
}

const ActivitySessionContext =
  createContext<ActivitySessionContextValue | null>(null);

function mergeActivityRuns(
  persistedRuns: readonly CptRunSummary[],
  browserRuns: readonly CptRunSummary[],
): CptRunSummary[] {
  const browserRunById = new Map(browserRuns.map((run) => [run.id, run]));
  const merged = persistedRuns.map((persistedRun) => {
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
  onPersistRun?: (run: CptRunSummary) => Promise<unknown>;
}) {
  const [browserRuns, setBrowserRuns] = useState<CptRunSummary[]>([]);
  const [writeStatus, setWriteStatus] = useState<
    Exclude<ActivitySessionContextValue["persistenceStatus"], "disabled" | "not-applicable">
  >("saved");
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(null);
  const nextSequence = useRef(1);
  const persistenceAttemptedRunIds = useRef(new Set<string>());
  const completedEvents = useRef(new WeakMap<CptTrialEvent[], CptRunSummary>());
  const cptRuns = useMemo(
    () => mergeActivityRuns(initialRuns, browserRuns),
    [browserRuns, initialRuns],
  );
  const persistenceStatus: ActivitySessionContextValue["persistenceStatus"] =
    storageMode !== "firebase"
      ? "not-applicable"
      : !cloudSyncEnabled
        ? "disabled"
        : writeStatus;

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
        setWriteStatus("saving");
        setPersistenceMessage(null);
        void onPersistRun(run)
          .then(() => {
            setWriteStatus("saved");
            setPersistenceMessage("Activity summary and CPT session metadata were saved to your Firebase account. Trial events were not uploaded.");
          })
          .catch((error: unknown) => {
            setWriteStatus("failed");
            setPersistenceMessage(
              error instanceof Error
                ? error.message
                : "Cloud synchronization failed. This summary remains only in the current browser session.",
            );
          });
      }
    }

    return run;
  }, [cloudSyncEnabled, onPersistRun, participantId, storageMode]);

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
