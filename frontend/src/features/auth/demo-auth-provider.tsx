"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { PortalRole } from "@/features/auth/portal-role";
import {
  clearDemoRoleCookie,
  DEMO_SESSION_EVENT,
  readDemoRoleCookie,
  writeDemoRoleCookie,
} from "@/lib/demo/demo-session";

interface DemoAuthContextValue {
  demoRole: PortalRole | null;
  ready: boolean;
  enterDemoSession: (role: PortalRole) => void;
  exitDemoSession: () => void;
}

const DemoAuthContext = createContext<DemoAuthContextValue | null>(null);

function subscribeToDemoSession(callback: () => void): () => void {
  window.addEventListener(DEMO_SESSION_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(DEMO_SESSION_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const demoRole = useSyncExternalStore(
    subscribeToDemoSession,
    readDemoRoleCookie,
    () => null,
  );

  const enterDemoSession = useCallback((role: PortalRole) => {
    writeDemoRoleCookie(role);
  }, []);

  const exitDemoSession = useCallback(() => {
    clearDemoRoleCookie();
  }, []);

  const value = useMemo<DemoAuthContextValue>(
    () => ({ demoRole, ready: true, enterDemoSession, exitDemoSession }),
    [demoRole, enterDemoSession, exitDemoSession],
  );

  return (
    <DemoAuthContext.Provider value={value}>
      {children}
    </DemoAuthContext.Provider>
  );
}

export function useDemoAuth(): DemoAuthContextValue {
  const context = useContext(DemoAuthContext);

  if (!context) {
    throw new Error("useDemoAuth must be used inside DemoAuthProvider.");
  }

  return context;
}
