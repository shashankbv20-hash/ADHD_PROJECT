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
import { processingStages } from "@/features/upload/processing-stages";
import type { DemoUploadSession, ProcessingStageId } from "@/types";

export type NewDemoUploadSession = Pick<
  DemoUploadSession,
  "fileName" | "fileSizeBytes" | "fileExtension" | "protocol"
>;

interface DemoSessionContextValue {
  sessions: DemoUploadSession[];
  createSession: (input: NewDemoUploadSession) => DemoUploadSession;
  getSession: (sessionId: string) => DemoUploadSession | undefined;
  advanceStage: (sessionId: string) => void;
  cancelSession: (sessionId: string) => void;
}

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<DemoUploadSession[]>([]);
  const nextSequence = useRef(1);

  const createSession = useCallback((input: NewDemoUploadSession) => {
    const sequence = nextSequence.current;
    nextSequence.current += 1;

    const timestamp = new Date().toISOString();
    const session: DemoUploadSession = {
      ...input,
      id: `DEMO-EEG-${String(sequence).padStart(4, "0")}`,
      uploadedAt: timestamp,
      consentAcceptedAt: timestamp,
      status: "processing",
      completedStageIds: ["received", "validated"],
      isDemo: true,
    };

    setSessions((current) => [session, ...current]);
    return session;
  }, []);

  const getSession = useCallback(
    (sessionId: string) =>
      sessions.find((session) => session.id === sessionId),
    [sessions],
  );

  const advanceStage = useCallback((sessionId: string) => {
    setSessions((current) =>
      current.map((session) => {
        if (session.id !== sessionId) {
          return session;
        }

        const nextStage = processingStages.find(
          (stage) => !session.completedStageIds.includes(stage.id),
        );

        if (!nextStage) {
          return session;
        }

        const completedStageIds: ProcessingStageId[] = [
          ...session.completedStageIds,
          nextStage.id,
        ];

        return {
          ...session,
          completedStageIds,
          status:
            completedStageIds.length === processingStages.length
              ? "complete"
              : "processing",
        };
      }),
    );
  }, []);

  const cancelSession = useCallback((sessionId: string) => {
    setSessions((current) =>
      current.filter((session) => session.id !== sessionId),
    );
  }, []);

  const value = useMemo(
    () => ({
      sessions,
      createSession,
      getSession,
      advanceStage,
      cancelSession,
    }),
    [sessions, createSession, getSession, advanceStage, cancelSession],
  );

  return (
    <DemoSessionContext.Provider value={value}>
      {children}
    </DemoSessionContext.Provider>
  );
}

export function useDemoSessions(): DemoSessionContextValue {
  const context = useContext(DemoSessionContext);

  if (!context) {
    throw new Error(
      "useDemoSessions must be used within DemoSessionProvider.",
    );
  }

  return context;
}
