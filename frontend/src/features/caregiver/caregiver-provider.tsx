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
  createCaregiverViewer,
  type CaregiverSubjectData,
  type SharedSubjectView,
} from "@/lib/backend/caregiver";
import { describeSyncError } from "@/lib/backend/sync-controller";

type LoadStatus = "loading" | "ready" | "error";

interface CaregiverContextValue {
  /** The signed-in caregiver's own ID, which they give to a participant to be added. */
  caregiverId: string;
  status: LoadStatus;
  error: string | null;
  shared: SharedSubjectView[];
  refresh: () => Promise<void>;
  loadSubject: (subjectId: string) => Promise<CaregiverSubjectData>;
  stopViewing: (subjectId: string, relationshipId: string) => Promise<void>;
}

const CaregiverContext = createContext<CaregiverContextValue | null>(null);

/**
 * Read-only access for a caregiver account: lists the participants who currently share
 * with them and loads each one's progress. It exposes no write other than "stop viewing".
 */
export function CaregiverProvider({
  user,
  baseUrl,
  children,
}: {
  user: User;
  baseUrl: string;
  children: ReactNode;
}) {
  const viewer = useMemo(
    () =>
      createCaregiverViewer(
        createBackendClient({ baseUrl, getIdToken: (forceRefresh) => user.getIdToken(forceRefresh) }),
      ),
    [baseUrl, user],
  );

  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState<SharedSubjectView[]>([]);
  const loadVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = (loadVersion.current += 1);

    try {
      const items = await viewer.listShared();
      if (version === loadVersion.current) {
        setShared(items);
        setStatus("ready");
        setError(null);
      }
    } catch (caught) {
      if (version === loadVersion.current) {
        setStatus("error");
        setError(describeSyncError(caught));
      }
    }
  }, [viewer]);

  useEffect(() => {
    // Loading remote state on mount is the purpose of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    return () => {
      loadVersion.current += 1;
    };
  }, [refresh]);

  const loadSubject = useCallback(
    async (subjectId: string) => {
      try {
        return await viewer.loadSubject(subjectId);
      } catch (caught) {
        throw new Error(describeSyncError(caught), { cause: caught });
      }
    },
    [viewer],
  );

  const stopViewing = useCallback(
    async (subjectId: string, relationshipId: string) => {
      try {
        await viewer.stopViewing(subjectId, relationshipId);
      } catch (caught) {
        throw new Error(describeSyncError(caught), { cause: caught });
      }
      await refresh();
    },
    [refresh, viewer],
  );

  const value = useMemo<CaregiverContextValue>(
    () => ({ caregiverId: user.uid, status, error, shared, refresh, loadSubject, stopViewing }),
    [user.uid, status, error, shared, refresh, loadSubject, stopViewing],
  );

  return <CaregiverContext.Provider value={value}>{children}</CaregiverContext.Provider>;
}

export function useCaregiver(): CaregiverContextValue {
  const context = useContext(CaregiverContext);

  if (!context) {
    throw new Error("useCaregiver must be used within CaregiverProvider.");
  }

  return context;
}
