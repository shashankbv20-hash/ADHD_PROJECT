"use client";

import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
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
import { getFrontendConfig, type DataProviderMode } from "@/lib/config/frontend-config";
import { getFirebaseClientServices } from "@/lib/firebase/firebase-client";
import {
  FirebaseOperationError,
  normalizeFirebaseError,
} from "@/lib/firebase/firebase-errors";
import {
  ensureFirebaseUserProfile,
  loadFirebaseAccountSnapshot,
  saveFirebaseCptRun,
  saveFirebaseReportSummary,
  updateFirebaseCloudSyncPreference,
} from "@/lib/firebase/firebase-data-service";
import type {
  FirebaseAccountSnapshot,
  FirebaseDigitalTwinSnapshot,
  FirebaseSavedReportSummary,
} from "@/lib/firebase/firebase-types";
import type { PortalRole } from "@/features/auth/portal-role";
import type { CptRunSummary } from "@/types";

export type FirebaseAuthStatus =
  | "disabled"
  | "loading"
  | "loading-account"
  | "signed-out"
  | "signed-in"
  | "profile-error"
  | "account-error"
  | "unavailable";

type ProviderMode = DataProviderMode | "invalid";

interface FirebaseAuthContextValue {
  providerMode: ProviderMode;
  status: FirebaseAuthStatus;
  user: User | null;
  account: FirebaseAccountSnapshot | null;
  error: FirebaseOperationError | null;
  authorizedRole: PortalRole | null;
  claimsStatus: "idle" | "loading" | "ready";
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  getAuthorizedRole: () => Promise<PortalRole | null>;
  resetPassword: (email: string) => Promise<void>;
  retryProfileSetup: () => Promise<void>;
  reloadAccount: () => Promise<void>;
  setCloudSyncEnabled: (enabled: boolean) => Promise<void>;
  persistCptRun: (run: CptRunSummary) => Promise<FirebaseDigitalTwinSnapshot>;
  saveReportSummary: (run: CptRunSummary) => Promise<FirebaseSavedReportSummary>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | null>(null);

function getSelectedProviderMode(): ProviderMode {
  const config = getFrontendConfig();
  return config.valid ? config.provider : "invalid";
}

function readClaimRole(claims: Record<string, unknown>): PortalRole {
  return claims.role === "clinician" || claims.role === "researcher"
    ? claims.role
    : "participant";
}

export function FirebaseAuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const config = getFrontendConfig();
  const providerMode = getSelectedProviderMode();
  const [status, setStatus] = useState<FirebaseAuthStatus>(() =>
    providerMode === "firebase"
      ? "loading"
      : providerMode === "invalid"
        ? "unavailable"
        : "disabled",
  );
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<FirebaseAccountSnapshot | null>(null);
  const [authorizedRole, setAuthorizedRole] = useState<PortalRole | null>(null);
  const [claimsStatus, setClaimsStatus] = useState<
    "idle" | "loading" | "ready"
  >("idle");
  const [error, setError] = useState<FirebaseOperationError | null>(() =>
    config.valid
      ? null
      : new FirebaseOperationError("not-configured", config.error),
  );
  const requestVersionRef = useRef(0);
  const userRef = useRef<User | null>(null);
  const accountRef = useRef<FirebaseAccountSnapshot | null>(null);
  const registeringRef = useRef(false);
  const syncBlockedRef = useRef(false);

  const loadAccountForUser = useCallback(
    async (currentUser: User, requestedDisplayName?: string) => {
      const services = getFirebaseClientServices();

      if (!services) {
        throw new FirebaseOperationError(
          "not-configured",
          "Firebase Web App configuration is required before an account can be loaded.",
        );
      }

      // Ignore async work for an account that has since signed out or switched.
      if (services.auth.currentUser?.uid !== currentUser.uid) return;

      const requestVersion = ++requestVersionRef.current;
      userRef.current = currentUser;
      setUser(currentUser);
      setClaimsStatus("loading");

      let role: PortalRole = "participant";

      try {
        const tokenResult = await currentUser.getIdTokenResult();
        role = readClaimRole(tokenResult.claims);
      } catch {
        // Fail closed: a claim that cannot be verified never grants staff access.
        role = "participant";
      }

      if (
        requestVersion !== requestVersionRef.current ||
        services.auth.currentUser?.uid !== currentUser.uid
      ) {
        return null;
      }

      setAuthorizedRole(role);
      setClaimsStatus("ready");

      if (role !== "participant") {
        accountRef.current = null;
        setAccount(null);
        setStatus("signed-in");
        setError(null);
        return null;
      }

      const accountAlreadyLoaded =
        accountRef.current?.profile.uid === currentUser.uid;

      if (!accountAlreadyLoaded) {
        setStatus("loading-account");
      }

      setError(null);

      try {
        await ensureFirebaseUserProfile(
          services.db,
          currentUser,
          requestedDisplayName,
        );
      } catch (caughtError) {
        const normalized = normalizeFirebaseError(
          caughtError,
          "profile-initialization",
        );

        if (requestVersion === requestVersionRef.current && services.auth.currentUser?.uid === currentUser.uid) {
          if (!accountAlreadyLoaded) {
            accountRef.current = null;
            setAccount(null);
            setStatus("profile-error");
          }
          setError(normalized);
        }

        throw normalized;
      }

      try {
        const nextAccount = await loadFirebaseAccountSnapshot(
          services.db,
          currentUser.uid,
        );

        if (requestVersion === requestVersionRef.current && services.auth.currentUser?.uid === currentUser.uid) {
          accountRef.current = nextAccount;
          setAccount(nextAccount);
          setStatus("signed-in");
          setError(null);
        }

        return nextAccount;
      } catch (caughtError) {
        const normalized = normalizeFirebaseError(caughtError);

        if (requestVersion === requestVersionRef.current && services.auth.currentUser?.uid === currentUser.uid) {
          // A failed background refresh must not discard an unsaved local run.
          if (!accountAlreadyLoaded) {
            accountRef.current = null;
            syncBlockedRef.current = false;
            setAccount(null);
            setStatus("account-error");
          }
          setError(normalized);
        }

        throw normalized;
      }
    },
    [],
  );

  useEffect(() => {
    if (providerMode !== "firebase") {
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | null = null;
    void Promise.resolve().then(async () => {
        const services = getFirebaseClientServices();
        if (!services) throw new FirebaseOperationError("not-configured", "Firebase Web App settings are missing.");
        await setPersistence(services.auth, browserLocalPersistence);
        if (!active) {
          return;
        }

        void getRedirectResult(services.auth).catch((caughtError: unknown) => {
          if (active) {
            setError(normalizeFirebaseError(caughtError));
          }
        });

        unsubscribe = onAuthStateChanged(services.auth, (nextUser) => {
          if (!active) return;
          if (!nextUser) {
            requestVersionRef.current += 1;
            userRef.current = null;
            accountRef.current = null;
            setUser(null);
            setAccount(null);
            setAuthorizedRole(null);
            setClaimsStatus("idle");
            setError(null);
            setStatus("signed-out");
            return;
          }

          if (!registeringRef.current) {
            void loadAccountForUser(nextUser).catch(() => undefined);
          }
        }, (caughtError) => {
          if (active) {
            setStatus("unavailable");
            setError(normalizeFirebaseError(caughtError));
          }
        });
      })
      .catch((caughtError: unknown) => {
        if (active) {
          setStatus("unavailable");
          setError(normalizeFirebaseError(caughtError));
        }
      });

    return () => {
      active = false;
      requestVersionRef.current += 1;
      unsubscribe?.();
    };
  }, [loadAccountForUser, providerMode]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const services = getFirebaseClientServices();

      if (providerMode !== "firebase" || !services) {
        throw new FirebaseOperationError(
          "not-configured",
          "Firebase Authentication is not available for this provider configuration.",
        );
      }

      setError(null);

      try {
        await signInWithEmailAndPassword(services.auth, email.trim(), password);
      } catch (caughtError) {
        const normalized = normalizeFirebaseError(
          caughtError,
          "invalid-credentials",
        );
        setError(normalized);
        throw normalized;
      }
    },
    [providerMode],
  );

  const getAuthorizedRole = useCallback(async (): Promise<PortalRole | null> => {
    const services = getFirebaseClientServices();
    const currentUser = services?.auth.currentUser;

    if (!services || !currentUser) {
      return null;
    }

    setClaimsStatus("loading");

    try {
      const tokenResult = await currentUser.getIdTokenResult(true);
      const role = readClaimRole(tokenResult.claims);
      setAuthorizedRole(role);
      setClaimsStatus("ready");
      return role;
    } catch (caughtError) {
      const normalized = normalizeFirebaseError(caughtError, "account-load");
      setClaimsStatus("ready");
      setError(normalized);
      throw normalized;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const services = getFirebaseClientServices();

    if (providerMode !== "firebase" || !services) {
      throw new FirebaseOperationError(
        "not-configured",
        "Firebase Authentication is not available for this provider configuration.",
      );
    }

    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const prefersRedirect =
      typeof window !== "undefined" &&
      (window.matchMedia("(max-width: 639px)").matches ||
        /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent));

    try {
      if (prefersRedirect) {
        await signInWithRedirect(services.auth, provider);
        return;
      }

      await signInWithPopup(services.auth, provider);
    } catch (caughtError) {
      const code =
        typeof caughtError === "object" &&
        caughtError !== null &&
        "code" in caughtError
          ? String(caughtError.code)
          : "";

      if (code.includes("popup-blocked")) {
        try {
          await signInWithRedirect(services.auth, provider);
          return;
        } catch (redirectError) {
          const normalized = normalizeFirebaseError(redirectError);
          setError(normalized);
          throw normalized;
        }
      }

      const normalized = normalizeFirebaseError(caughtError);
      setError(normalized);
      throw normalized;
    }
  }, [providerMode]);

  const register = useCallback(
    async (displayName: string, email: string, password: string) => {
      const services = getFirebaseClientServices();

      if (providerMode !== "firebase" || !services) {
        throw new FirebaseOperationError(
          "not-configured",
          "Firebase Authentication is not available for this provider configuration.",
        );
      }

      let createdUser: User | null = null;
      let profileReady = false;
      registeringRef.current = true;

      try {
        const credential = await createUserWithEmailAndPassword(
          services.auth,
          email.trim(),
          password,
        );
        createdUser = credential.user;
        await updateProfile(createdUser, { displayName: displayName.trim() });
        await ensureFirebaseUserProfile(
          services.db,
          createdUser,
          displayName.trim(),
        );
        profileReady = true;
        await loadAccountForUser(createdUser, displayName.trim());
      } catch (caughtError) {
        if (createdUser && services.auth.currentUser?.uid === createdUser.uid) {
          const underlying = normalizeFirebaseError(
            caughtError,
            profileReady ? "account-load" : "profile-initialization",
          );
          const actionableError = new FirebaseOperationError(
            profileReady ? "account-load" : "profile-initialization",
            underlying.message,
          );
          requestVersionRef.current += 1;
          userRef.current = createdUser;
          setUser(createdUser);
          accountRef.current = null;
          setAccount(null);
          setStatus(profileReady ? "account-error" : "profile-error");
          setError(actionableError);
          throw actionableError;
        }

        const normalized = normalizeFirebaseError(caughtError, "unknown");
        setError(normalized);
        throw normalized;
      } finally {
        registeringRef.current = false;
      }
    },
    [loadAccountForUser, providerMode],
  );

  const signOutUser = useCallback(async () => {
    const services = getFirebaseClientServices();

    if (!services) {
      throw new FirebaseOperationError(
        "not-configured",
        "Firebase is not configured.",
      );
    }

    try {
      await signOut(services.auth);
    } catch (caughtError) {
      throw normalizeFirebaseError(caughtError);
    }
  }, []);

  const resetPassword = useCallback(
    async (email: string) => {
      const services = getFirebaseClientServices();

      if (providerMode !== "firebase" || !services) {
        throw new FirebaseOperationError(
          "not-configured",
          "Firebase Authentication is not configured for password reset.",
        );
      }

      try {
        await sendPasswordResetEmail(services.auth, email.trim());
      } catch (caughtError) {
        throw normalizeFirebaseError(caughtError, "invalid-credentials");
      }
    },
    [providerMode],
  );

  const reloadAccount = useCallback(async () => {
    const currentUser = userRef.current;

    if (!currentUser) {
      throw new FirebaseOperationError(
        "invalid-credentials",
        "Sign in before loading participant data.",
      );
    }

    await loadAccountForUser(currentUser);
  }, [loadAccountForUser]);

  const retryProfileSetup = useCallback(async () => {
    const currentUser = userRef.current;

    if (!currentUser) {
      throw new FirebaseOperationError(
        "invalid-credentials",
        "Sign in again before retrying participant profile setup.",
      );
    }

    await loadAccountForUser(currentUser, currentUser.displayName ?? undefined);
  }, [loadAccountForUser]);

  const setCloudSyncEnabled = useCallback(
    async (enabled: boolean) => {
      const services = getFirebaseClientServices();
      const currentUser = userRef.current;

      if (!services || !currentUser) {
        throw new FirebaseOperationError(
          "invalid-credentials",
          "Sign in before changing the cloud synchronization preference.",
        );
      }

      const previouslyEnabled =
        accountRef.current?.profile.cloudSyncEnabled ?? false;

      // Block new submissions immediately while the preference is being committed.
      // Already submitted writes cannot be recalled; rules check the saved flag.
      syncBlockedRef.current = true;

      try {
        const profile = await updateFirebaseCloudSyncPreference(
          services.db,
          currentUser.uid,
          enabled,
        );
        const currentAccount = accountRef.current;

        syncBlockedRef.current = !profile.cloudSyncEnabled;

        if (currentAccount?.profile.uid === currentUser.uid && services.auth.currentUser?.uid === currentUser.uid) {
          const nextAccount = { ...currentAccount, profile };
          accountRef.current = nextAccount;
          setAccount(nextAccount);
        }
      } catch (caughtError) {
        syncBlockedRef.current = !previouslyEnabled;
        throw normalizeFirebaseError(caughtError);
      }
    },
    [],
  );

  const persistCptRun = useCallback(
    async (run: CptRunSummary) => {
      const services = getFirebaseClientServices();
      const currentUser = userRef.current;
      const currentAccount = accountRef.current;

      if (!services || !currentUser || !currentAccount) {
        throw new FirebaseOperationError(
          "invalid-credentials",
          "Sign in before saving activity summaries.",
        );
      }

      if (syncBlockedRef.current || !currentAccount.profile.cloudSyncEnabled) {
        throw new FirebaseOperationError(
          "sync-disabled",
          "Cloud synchronization is turned off. The activity remains only in this browser session.",
        );
      }

      if (run.participantId !== currentUser.uid) {
        throw new FirebaseOperationError(
          "invalid-data",
          "The activity summary does not belong to the signed-in participant.",
        );
      }

      try {
        const twin = await saveFirebaseCptRun(
          services.db,
          currentUser.uid,
          run,
        );
        // The write already succeeded; a failed refresh must not report the save as failed.
        await loadAccountForUser(currentUser).catch(() => undefined);
        return twin;
      } catch (caughtError) {
        await loadAccountForUser(currentUser).catch(() => undefined);
        throw normalizeFirebaseError(caughtError);
      }
    },
    [loadAccountForUser],
  );

  const saveReportSummary = useCallback(
    async (run: CptRunSummary) => {
      const services = getFirebaseClientServices();
      const currentUser = userRef.current;
      const currentAccount = accountRef.current;

      if (!services || !currentUser || !currentAccount) {
        throw new FirebaseOperationError(
          "invalid-credentials",
          "Sign in before saving a report summary.",
        );
      }

      if (syncBlockedRef.current || !currentAccount.profile.cloudSyncEnabled) {
        throw new FirebaseOperationError(
          "sync-disabled",
          "Turn on cloud synchronization before saving a report summary.",
        );
      }

      if (run.participantId !== currentUser.uid || run.mode !== "scored") {
        throw new FirebaseOperationError(
          "invalid-data",
          "Only the signed-in participant's scored CPT summaries can be saved.",
        );
      }

      const report = await saveFirebaseReportSummary(
        services.db,
        currentUser.uid,
        run,
      );
      // The report write already succeeded; a failed refresh must not report it as failed.
      await loadAccountForUser(currentUser).catch(() => undefined);
      return report;
    },
    [loadAccountForUser],
  );

  const value = useMemo<FirebaseAuthContextValue>(
    () => ({
      providerMode,
      status,
      user,
      account,
      error,
      authorizedRole,
      claimsStatus,
      signIn,
      signInWithGoogle,
      register,
      signOutUser,
      getAuthorizedRole,
      resetPassword,
      retryProfileSetup,
      reloadAccount,
      setCloudSyncEnabled,
      persistCptRun,
      saveReportSummary,
    }),
    [
      providerMode,
      status,
      user,
      account,
      error,
      authorizedRole,
      claimsStatus,
      signIn,
      signInWithGoogle,
      register,
      signOutUser,
      getAuthorizedRole,
      resetPassword,
      retryProfileSetup,
      reloadAccount,
      setCloudSyncEnabled,
      persistCptRun,
      saveReportSummary,
    ],
  );

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth(): FirebaseAuthContextValue {
  const context = useContext(FirebaseAuthContext);

  if (!context) {
    throw new Error("useFirebaseAuth must be used inside FirebaseAuthProvider.");
  }

  return context;
}
