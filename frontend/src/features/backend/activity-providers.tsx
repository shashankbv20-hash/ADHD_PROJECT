"use client";

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  ActivitySessionProvider,
  mergeActivityRuns,
  useActivitySessions,
  type PersistRunOutcome,
} from "@/features/activities/activity-session-store";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { useBackendSync } from "@/features/backend/backend-sync-provider";
import type { CptRunSummary } from "@/types";

/**
 * Firebase-only mode (no API base URL configured): CPT summaries are written
 * directly to the participant's Firestore account, exactly as before.
 */
export function FirebaseDirectActivityProvider({
  participantId,
  cloudSyncEnabled,
  initialRuns,
  children,
}: {
  participantId: string;
  cloudSyncEnabled: boolean;
  initialRuns: CptRunSummary[];
  children: ReactNode;
}) {
  const { persistCptRun } = useFirebaseAuth();
  const onPersistRun = useCallback(
    async (run: CptRunSummary): Promise<PersistRunOutcome | void> => {
      await persistCptRun(run);
    },
    [persistCptRun],
  );

  return (
    <ActivitySessionProvider
      participantId={participantId}
      storageMode="firebase"
      cloudSyncEnabled={cloudSyncEnabled}
      initialRuns={initialRuns}
      onPersistRun={onPersistRun}
    >
      {children}
    </ActivitySessionProvider>
  );
}

/** Retries runs that were waiting for consent, once, when consent becomes granted. */
function RetryAfterConsent() {
  const { consent } = useBackendSync();
  const { unsyncedRunCount, retryUnsyncedRuns } = useActivitySessions();
  const previouslyGranted = useRef(consent.status === "granted");

  useEffect(() => {
    const granted = consent.status === "granted";

    if (granted && !previouslyGranted.current && unsyncedRunCount > 0) {
      retryUnsyncedRuns();
    }

    previouslyGranted.current = granted;
  }, [consent.status, retryUnsyncedRuns, unsyncedRunCount]);

  return null;
}

/**
 * API-backed mode (Firebase identity + FastAPI persistence). Scored CPT runs
 * are saved ONLY through the backend, after explicit research consent. The
 * direct Firestore CPT write is deliberately not wired here, so a run is never
 * written to two authoritative stores. Pre-existing Firestore runs stay visible
 * and untouched.
 */
export function ApiBackedActivityProvider({
  participantId,
  legacyRuns,
  children,
}: {
  participantId: string;
  legacyRuns: CptRunSummary[];
  children: ReactNode;
}) {
  const { serverRuns, persistRun } = useBackendSync();

  const initialRuns = useMemo(
    () => mergeActivityRuns([...serverRuns, ...legacyRuns], []),
    [legacyRuns, serverRuns],
  );

  return (
    <ActivitySessionProvider
      participantId={participantId}
      storageMode="firebase"
      persistenceTarget="backend"
      cloudSyncEnabled
      initialRuns={initialRuns}
      onPersistRun={persistRun}
    >
      <RetryAfterConsent />
      {children}
    </ActivitySessionProvider>
  );
}
