"use client";

import {
  ArrowRight,
  Eye,
  EyeOff,
  FlaskConical,
  HeartHandshake,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { validateEmail, validatePassword } from "@/features/auth/validation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FieldError,
  FieldHint,
  Input,
  Label,
} from "@/components/ui/input";
import { useDemoAuth } from "@/features/auth/demo-auth-provider";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import {
  isDemoPortalRole,
  isPortalRole,
  portalLabels,
  portalRoutes,
  type DemoPortalRole,
  type PortalRole,
} from "@/features/auth/portal-role";
import { demoProfiles } from "@/lib/demo/demo-session";
import { cn } from "@/lib/utils";

type FieldErrors = Partial<Record<"email" | "password", string>>;
type SubmitStatus = "idle" | "submitting" | "unavailable" | "complete";
type AccessDenied = { requested: PortalRole; authorized: PortalRole };

const PENDING_ROLE_KEY = "attune.login.pending-role";

const roleOptions: Array<{
  id: PortalRole;
  icon: typeof UserRound;
  title: string;
  description: string;
}> = [
  {
    id: "participant",
    icon: UserRound,
    title: "Participant",
    description: "Your EEG sessions, activities, and Digital Twin.",
  },
  {
    id: "caregiver",
    icon: HeartHandshake,
    title: "Caregiver",
    description: "Read-only progress shared with you by a participant.",
  },
  {
    id: "clinician",
    icon: Stethoscope,
    title: "Clinician",
    description: "Participant review and session comparison.",
  },
  {
    id: "researcher",
    icon: FlaskConical,
    title: "Researcher",
    description: "Models, datasets, and research experiments.",
  },
];

// Demo accounts exist only for roles that have synthetic data; there is no demo caregiver.
const demoRoleOptions = roleOptions.filter(
  (option): option is (typeof roleOptions)[number] & { id: DemoPortalRole } => isDemoPortalRole(option.id),
);

function readPendingRole(): PortalRole | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.sessionStorage.getItem(PENDING_ROLE_KEY);
  return isPortalRole(value) ? value : null;
}

function writePendingRole(role: PortalRole): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(PENDING_ROLE_KEY, role);
  }
}

function clearPendingRole(): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(PENDING_ROLE_KEY);
  }
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.58v2.93h3.88c2.27-2.09 3.54-5.17 3.54-8.75Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-2.93c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.02A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.36A7.2 7.2 0 0 1 4.89 12c0-.82.14-1.61.38-2.36V6.62H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.38l4.01-3.02Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.62l4.01 3.02C6.22 6.79 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const routedRef = useRef(false);
  const passwordResetRef = useRef(false);
  const auth = useFirebaseAuth();
  const demo = useDemoAuth();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [selectedRole, setSelectedRole] = useState<PortalRole>("participant");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [authError, setAuthError] = useState<string>();
  const [resetMessage, setResetMessage] = useState<string>();
  const [resetBusy, setResetBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState<DemoPortalRole | null>(null);
  const [accessDenied, setAccessDenied] = useState<AccessDenied | null>(null);
  const shownAuthError =
    authError ??
    (auth.providerMode === "firebase" && auth.status !== "signed-in"
      ? auth.error?.message
      : undefined);
  const firebaseAuthReady =
    auth.providerMode !== "firebase" || auth.status === "signed-out";
  const googleAvailable = auth.providerMode === "firebase";
  const authBusy =
    auth.providerMode === "firebase" &&
    (auth.status === "loading" || auth.status === "loading-account");
  const busy =
    status === "submitting" || googleBusy || demoBusy !== null || authBusy;

  useEffect(() => {
    if (auth.status === "signed-out") {
      routedRef.current = false;
    }
  }, [auth.status]);

  useEffect(() => {
    const authSettled =
      auth.status === "signed-in" ||
      auth.status === "profile-error" ||
      auth.status === "account-error";

    if (
      auth.providerMode !== "firebase" ||
      !authSettled ||
      routedRef.current
    ) {
      return;
    }

    routedRef.current = true;
    const requested = readPendingRole() ?? auth.authorizedRole ?? "participant";

    void (async () => {
      try {
        const authorized =
          auth.authorizedRole ?? (await auth.getAuthorizedRole());

        if (!authorized) {
          routedRef.current = false;
          setAuthError(
            "The signed-in account could not be authorized. Sign out and try again.",
          );
          return;
        }

        clearPendingRole();
        submittingRef.current = false;
        setStatus("idle");

        if (requested === authorized) {
          setAccessDenied(null);
          router.replace(portalRoutes[authorized]);
          return;
        }

        setAccessDenied({ requested, authorized });
      } catch (error) {
        routedRef.current = false;
        setStatus("idle");
        setAuthError(
          error instanceof Error
            ? error.message
            : "Sign in could not be completed. Try again.",
        );
      }
    })();
  }, [
    auth.providerMode,
    auth.status,
    auth,
    router,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const nextErrors: FieldErrors = {};
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (emailError) {
      nextErrors.email = emailError;
    }

    if (passwordError) {
      nextErrors.password = passwordError;
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    submittingRef.current = true;
    setStatus("submitting");
    setAuthError(undefined);
    setAccessDenied(null);
    routedRef.current = false;

    if (auth.providerMode === "demo") {
      await new Promise((resolve) => setTimeout(resolve, 650));
      form.reset();
      setShowPassword(false);
      setStatus("unavailable");
      submittingRef.current = false;
      return;
    }

    if (auth.providerMode !== "firebase") {
      setStatus("unavailable");
      setAuthError("Authentication is unavailable for the selected data provider.");
      submittingRef.current = false;
      return;
    }

    writePendingRole(selectedRole);

    if (demo.demoRole) {
      demo.exitDemoSession();
    }

    try {
      await auth.signIn(email, password);
      form.reset();
      setShowPassword(false);
      setStatus("complete");
    } catch (error) {
      clearPendingRole();
      setStatus("idle");
      submittingRef.current = false;
      setAuthError(
        error instanceof Error
          ? error.message
          : "Sign in could not be completed. Try again.",
      );
    }
  }

  async function handleGoogleSignIn() {
    if (busy || !googleAvailable) {
      return;
    }

    setGoogleBusy(true);
    setAuthError(undefined);
    setAccessDenied(null);
    routedRef.current = false;
    writePendingRole(selectedRole);

    if (demo.demoRole) {
      demo.exitDemoSession();
    }

    try {
      await auth.signInWithGoogle();
    } catch (error) {
      clearPendingRole();
      setAuthError(
        error instanceof Error
          ? error.message
          : "Google sign-in could not be completed. Try again.",
      );
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleDemoSignIn(role: DemoPortalRole) {
    if (busy) {
      return;
    }

    setDemoBusy(role);
    setAuthError(undefined);
    setAccessDenied(null);
    clearPendingRole();

    try {
      if (auth.user) {
        await auth.signOutUser();
      }

      demo.enterDemoSession(role);
      router.push(portalRoutes[role]);
      router.refresh();
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "The demo session could not be started.",
      );
    } finally {
      setDemoBusy(null);
    }
  }

  async function handleSignOut() {
    setAuthError(undefined);
    setAccessDenied(null);
    clearPendingRole();
    routedRef.current = false;

    try {
      await auth.signOutUser();
      setStatus("idle");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Sign-out could not be completed.",
      );
    }
  }

  async function handlePasswordReset() {
    if (auth.providerMode !== "firebase" || passwordResetRef.current) {
      return;
    }

    const email = String(new FormData(formRef.current ?? undefined).get("email") ?? "");
    const emailError = validateEmail(email);

    if (emailError) {
      setErrors((current) => ({ ...current, email: emailError }));
      return;
    }

    passwordResetRef.current = true;
    setResetBusy(true);

    try {
      await auth.resetPassword(email);
      setResetMessage("If the address is registered, Firebase has sent a password-reset email.");
      setAuthError(undefined);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "The password-reset request could not be completed.",
      );
      setResetMessage(undefined);
    } finally {
      passwordResetRef.current = false;
      setResetBusy(false);
    }
  }

  if (auth.providerMode === "remote" || auth.providerMode === "invalid") {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Sign-in unavailable
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          {auth.providerMode === "invalid"
            ? auth.error?.message ?? "Frontend provider configuration is invalid."
            : "The remote provider has no confirmed authentication contract. No credentials were collected or sent."}
        </p>
        <Alert tone="warning" title="No authentication request was made" className="mt-6">
          Return to the public page or select Firebase/demo mode in the build
          configuration.
        </Alert>
        <Link
          href="/"
          className="mt-5 inline-flex text-sm font-medium text-brand-800 underline decoration-brand-300 underline-offset-2"
        >
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
        <ShieldCheck aria-hidden="true" className="size-4" />
        Secure access
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
        Sign in to Attune
      </h1>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        Choose the workspace you need. Access is limited to the role verified
        for your account.
      </p>

      {demo.demoRole ? (
        <Alert tone="info" title="Demo session active" className="mt-5">
          You are exploring as {portalLabels[demo.demoRole]}. Signing in with a
          real account exits demo mode.{" "}
          <button
            type="button"
            onClick={() => {
              demo.exitDemoSession();
              setAuthError(undefined);
            }}
            className="font-medium text-brand-800 underline decoration-brand-300 underline-offset-2"
          >
            Exit demo
          </button>
        </Alert>
      ) : null}

      {auth.providerMode === "firebase" ? (
        <Alert tone="info" title="Firebase Authentication" className="mt-5">
          Email/password and Google credentials are handled by Firebase.
          Participant profiles and opt-in account data are stored in Firestore;
          no EEG files are uploaded.
        </Alert>
      ) : (
        <Alert tone="info" title="Demo authentication only" className="mt-5">
          Email sign-in is not connected in demo mode. Use a one-click demo
          account below to explore the interface with synthetic data.
        </Alert>
      )}

      {auth.providerMode === "firebase" && auth.status === "loading" ? (
        <Alert tone="info" title="Checking Firebase authentication" className="mt-4">
          Sign-in controls will be available when Firebase initialization completes.
        </Alert>
      ) : null}
      {shownAuthError ? (
        <Alert tone="danger" title="Sign-in issue" className="mt-4">
          {shownAuthError}
        </Alert>
      ) : null}
      {resetMessage ? (
        <Alert tone="success" title="Password-reset request submitted" className="mt-4">
          {resetMessage}
        </Alert>
      ) : null}
      {accessDenied ? (
        <Alert
          tone="warning"
          title="Portal access denied"
          className="mt-4"
        >
          <p>
            The {portalLabels[accessDenied.requested].toLowerCase()} portal
            requires a verified {portalLabels[accessDenied.requested].toLowerCase()}{" "}
            role. This account is authorized for the{" "}
            {portalLabels[accessDenied.authorized].toLowerCase()} portal.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => router.replace(portalRoutes[accessDenied.authorized])}
            >
              Open {portalLabels[accessDenied.authorized]} portal
            </Button>
            <Button size="sm" variant="outline" onClick={handleSignOut}>
              <LogOut aria-hidden="true" className="size-4" />
              Sign out
            </Button>
          </div>
        </Alert>
      ) : null}

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-ink">
          Select a portal
        </legend>
        <p className="mt-1 text-xs leading-5 text-ink-subtle">
          Your account&apos;s verified role controls which portal opens.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {roleOptions.map((option) => {
            const Icon = option.icon;
            const selected = selectedRole === option.id;

            return (
              <label
                key={option.id}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-brand-400 focus-within:ring-offset-2",
                  selected
                    ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                    : "border-line bg-surface hover:border-brand-300",
                )}
              >
                <input
                  type="radio"
                  name="portal-role"
                  value={option.id}
                  checked={selected}
                  onChange={() => setSelectedRole(option.id)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    selected
                      ? "bg-brand-700 text-white"
                      : "bg-slate-100 text-ink-muted",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span className="text-sm font-semibold text-ink">
                  {option.title}
                </span>
                <span className="text-[11px] leading-4 text-ink-muted">
                  {option.description}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={handleGoogleSignIn}
          disabled={!googleAvailable || busy || !firebaseAuthReady}
          aria-busy={googleBusy}
        >
          {googleBusy ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          {googleBusy ? "Connecting to Google…" : "Continue with Google"}
        </Button>
        {!googleAvailable ? (
          <p className="mt-2 text-center text-[11px] leading-4 text-ink-subtle">
            Google sign-in requires Firebase provider mode.
          </p>
        ) : null}
      </div>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
          or continue with email
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onChange={() => {
          if (Object.keys(errors).length > 0) {
            setErrors({});
          }
        }}
        noValidate
        className="space-y-5"
      >
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            placeholder="you@example.org"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={
              errors.email ? "login-email-error" : "login-email-hint"
            }
          />
          {errors.email ? (
            <FieldError id="login-email-error">{errors.email}</FieldError>
          ) : (
            <FieldHint id="login-email-hint">
              Use the email associated with your Attune account.
            </FieldHint>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="login-password">Password</Label>
            {auth.providerMode === "firebase" ? (
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={status === "submitting" || resetBusy || !firebaseAuthReady}
                className="text-xs font-medium text-brand-800 underline decoration-brand-300 underline-offset-2 transition-colors hover:decoration-brand-700 disabled:opacity-50"
              >
                {resetBusy ? "Sending reset…" : "Forgot password?"}
              </button>
            ) : null}
          </div>
          <div className="relative">
            <Input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              style={{ paddingRight: "2.5rem" }}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "login-password-error" : "login-password-hint"
              }
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-slate-100 hover:text-ink"
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" className="size-4" />
              ) : (
                <Eye aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
          {errors.password ? (
            <FieldError id="login-password-error">
              {errors.password}
            </FieldError>
          ) : (
            <FieldHint id="login-password-hint">
              {auth.providerMode === "firebase"
                ? "Your password is sent directly to Firebase Authentication and is not stored by this app."
                : "Password validation is demonstrated locally. Nothing is stored."}
            </FieldHint>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={busy || !firebaseAuthReady}
          aria-busy={status === "submitting"}
        >
          {status === "submitting" ? (
            <>
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
              {auth.providerMode === "firebase" ? "Signing in" : "Checking interface"}
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      {status === "unavailable" && auth.providerMode === "demo" ? (
        <Alert
          tone="warning"
          title="Email authentication unavailable"
          className="mt-5"
        >
          No authentication backend is connected, so no credentials were sent
          or stored. Use a one-click demo account below.
        </Alert>
      ) : null}

      <Card className="mt-6 border-dashed bg-canvas/60">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm">One-click demo accounts</CardTitle>
          <CardDescription className="text-xs leading-5">
            Synthetic profiles with isolated records. No credentials are
            created or sent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4 pt-0">
          {demoRoleOptions.map((option) => {
            const profile = demoProfiles[option.id];
            const Icon = option.icon;
            const entering = demoBusy === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleDemoSignIn(option.id)}
                disabled={busy}
                className="group flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-ink-muted group-hover:bg-brand-100 group-hover:text-brand-800">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {profile.name}
                  </span>
                  <span className="block truncate text-[11px] text-ink-muted">
                    {profile.detail}
                  </span>
                </span>
                {entering ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin text-brand-700"
                  />
                ) : (
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700"
                  />
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <p className="mt-6 text-sm text-ink-muted">
        {auth.providerMode === "firebase" ? "Need a participant account?" : "New to Attune?"}{" "}
        <Link
          href="/register"
          className="font-medium text-brand-800 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-700"
        >
          {auth.providerMode === "firebase" ? "Create an account" : "Create a demo account"}
        </Link>
      </p>
    </div>
  );
}
