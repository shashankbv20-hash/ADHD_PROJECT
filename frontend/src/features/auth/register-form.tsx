"use client";

import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirmation,
} from "@/features/auth/validation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  FieldError,
  FieldHint,
  Input,
  Label,
} from "@/components/ui/input";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { FirebaseOperationError } from "@/lib/firebase/firebase-errors";

type FieldErrors = Partial<
  Record<"name" | "email" | "password" | "confirmation" | "consent", string>
>;
type SubmitStatus = "idle" | "submitting" | "unavailable";

export function RegisterForm() {
  const router = useRouter();
  const auth = useFirebaseAuth();
  const submittingRef = useRef(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string>();
  const shownSubmitError =
    submitError ??
    (auth.providerMode === "firebase" && auth.status === "unavailable"
      ? auth.error?.message
      : undefined);
  const firebaseAuthReady =
    auth.providerMode !== "firebase" || auth.status === "signed-out";

  useEffect(() => {
    if (auth.providerMode === "firebase" && auth.status === "signed-in") {
      router.replace("/participant");
    }
  }, [auth.providerMode, auth.status, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    const consent = formData.get("consent");

    const nextErrors: FieldErrors = {};
    const nameError = validateName(name);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password, 10);
    const confirmationError = validatePasswordConfirmation(
      password,
      confirmation,
    );

    if (nameError) {
      nextErrors.name = nameError;
    }

    if (emailError) {
      nextErrors.email = emailError;
    }

    if (passwordError) {
      nextErrors.password = passwordError;
    }

    if (confirmationError) {
      nextErrors.confirmation = confirmationError;
    }

    if (!consent) {
      nextErrors.consent = "Acknowledge the account data notice to continue.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    submittingRef.current = true;
    setStatus("submitting");
    setSubmitError(undefined);

    if (auth.providerMode === "demo") {
      await new Promise((resolve) => setTimeout(resolve, 700));
      form.reset();
      setShowPassword(false);
      setShowConfirmation(false);
      setStatus("unavailable");
      submittingRef.current = false;
      return;
    }

    if (auth.providerMode !== "firebase") {
      setStatus("idle");
      setSubmitError("Registration is unavailable for the selected data provider.");
      submittingRef.current = false;
      return;
    }

    try {
      await auth.register(name.trim(), email.trim(), password);
      form.reset();
      setShowPassword(false);
      setShowConfirmation(false);
      setStatus("idle");
      submittingRef.current = false;
      router.push("/participant");
    } catch (error) {
      setStatus("idle");
      submittingRef.current = false;
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The Firebase account could not be created.",
      );

      if (
        error instanceof FirebaseOperationError &&
        (error.code === "profile-initialization" || error.code === "account-load")
      ) {
        form.reset();
        router.push("/participant");
      }
    }
  }

  if (auth.providerMode === "remote" || auth.providerMode === "invalid") {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Registration unavailable
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          {auth.providerMode === "invalid"
            ? auth.error?.message ?? "Frontend provider configuration is invalid."
            : "The remote provider has no confirmed authentication contract. No registration details were collected or sent."}
        </p>
        <Alert tone="warning" title="No account was created" className="mt-6">
          Select a configured Firebase provider or use the demonstration provider.
          Public Firebase registration, when configured, creates participant
          accounts only.
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
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        {auth.providerMode === "firebase"
          ? "Create a participant account"
          : "Create a demo account"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        {auth.providerMode === "firebase"
          ? "Create a participant account with Firebase Authentication. Staff roles are not available through public registration."
          : "Preview the participant registration experience. Clinician and researcher access is provisioned separately and never through this form."}
      </p>

      {auth.providerMode === "firebase" ? (
        <Alert tone="info" title="Account and data notice" className="mt-6">
          Firebase Authentication manages the password. A participant profile
          is created in Firestore. This acknowledgement is not research consent,
          guardian consent, or child assent.
        </Alert>
      ) : (
        <Alert tone="info" title="No account will be created" className="mt-6">
          This form validates input locally for interface review. It does not
          create an account, store data, or contact an authentication service.
        </Alert>
      )}

      {auth.providerMode === "firebase" && auth.status === "loading" ? (
        <Alert tone="info" title="Checking Firebase authentication" className="mt-4">
          Registration will be available when Firebase initialization completes.
        </Alert>
      ) : null}
      {shownSubmitError ? (
        <Alert tone="danger" title="Registration could not be completed" className="mt-4">
          {shownSubmitError}
        </Alert>
      ) : null}

      <form
        onSubmit={handleSubmit}
        onChange={() => {
          if (Object.keys(errors).length > 0) {
            setErrors({});
          }
        }}
        noValidate
        className="mt-6 space-y-5"
      >
        <div className="space-y-1.5">
          <Label htmlFor="register-name">Full name</Label>
          <Input
            id="register-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={
              errors.name ? "register-name-error" : undefined
            }
          />
          {errors.name ? (
            <FieldError id="register-name-error">{errors.name}</FieldError>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            placeholder="you@example.org"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={
              errors.email ? "register-email-error" : "register-email-hint"
            }
          />
          {errors.email ? (
            <FieldError id="register-email-error">{errors.email}</FieldError>
          ) : (
            <FieldHint id="register-email-hint">
              {auth.providerMode === "firebase"
                ? "Use an email you can access for your Firebase participant account."
                : "Use an institutional or personal email for this demonstration."}
            </FieldHint>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="register-password">Password</Label>
          <div className="relative">
            <Input
              id="register-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 10 characters"
              style={{ paddingRight: "2.5rem" }}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password
                  ? "register-password-error"
                  : "register-password-hint"
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
            <FieldError id="register-password-error">
              {errors.password}
            </FieldError>
          ) : (
            <FieldHint id="register-password-hint">
              {auth.providerMode === "firebase"
                ? "At least 10 characters. Firebase Authentication stores the credential."
                : "At least 10 characters. Validation happens in the browser only."}
            </FieldHint>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="register-confirmation">Confirm password</Label>
          <div className="relative">
            <Input
              id="register-confirmation"
              name="confirmation"
              type={showConfirmation ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repeat your password"
              style={{ paddingRight: "2.5rem" }}
              aria-invalid={Boolean(errors.confirmation)}
              aria-describedby={
                errors.confirmation
                  ? "register-confirmation-error"
                  : undefined
              }
            />
            <button
              type="button"
              onClick={() => setShowConfirmation((value) => !value)}
              aria-label={
                showConfirmation
                  ? "Hide password confirmation"
                  : "Show password confirmation"
              }
              aria-pressed={showConfirmation}
              className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-slate-100 hover:text-ink"
            >
              {showConfirmation ? (
                <EyeOff aria-hidden="true" className="size-4" />
              ) : (
                <Eye aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
          {errors.confirmation ? (
            <FieldError id="register-confirmation-error">
              {errors.confirmation}
            </FieldError>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label className="flex items-start gap-2.5 text-sm leading-6 text-ink-muted">
            <input
              id="register-consent"
              name="consent"
              type="checkbox"
              aria-invalid={Boolean(errors.consent)}
              aria-describedby={
                errors.consent ? "register-consent-error" : undefined
              }
              className="mt-0.5 size-4 shrink-0 rounded border-line-strong accent-brand-700"
            />
            <span>
              {auth.providerMode === "firebase"
                ? "I understand that this creates a Firebase participant account and profile. This acknowledgement does not represent formal research consent, guardian consent, or child assent. See the "
                : "I understand that this is a research interface prototype, not a diagnostic service, and that no real account or data will be created. See the "}
              <Link
                href="/#research-transparency"
                className="font-medium text-brand-800 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-700"
              >
                research data policy
              </Link>
              .
            </span>
          </label>
          {errors.consent ? (
            <FieldError id="register-consent-error">{errors.consent}</FieldError>
          ) : null}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={status === "submitting" || !firebaseAuthReady}
          aria-busy={status === "submitting"}
        >
          {status === "submitting" ? (
            <>
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
              {auth.providerMode === "firebase"
                ? "Creating account"
                : "Checking interface"}
            </>
          ) : (
            auth.providerMode === "firebase" ? "Create participant account" : "Create demo account"
          )}
        </Button>
      </form>

      {status === "unavailable" && auth.providerMode === "demo" ? (
        <Alert
          tone="warning"
          title="Registration service unavailable"
          className="mt-5"
        >
          No registration backend is connected, so no account was created and
          no data was stored. You can{" "}
          <Link
            href="/participant"
            className="font-medium text-brand-800 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-700"
          >
            open the demo workspace
          </Link>{" "}
          to review the interface.
        </Alert>
      ) : null}

      <p className="mt-6 text-sm text-ink-muted">
        {auth.providerMode === "firebase" ? "Already have an account?" : "Already have a demo account?"}{" "}
        <Link
          href="/login"
          className="font-medium text-brand-800 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-700"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
