export type FirebaseOperationErrorCode =
  | "not-configured"
  | "network"
  | "permission-denied"
  | "invalid-credentials"
  | "email-method-disabled"
  | "method-disabled"
  | "popup-cancelled"
  | "popup-blocked"
  | "account-conflict"
  | "configuration"
  | "email-in-use"
  | "weak-password"
  | "too-many-requests"
  | "profile-initialization"
  | "account-load"
  | "sync-disabled"
  | "partial-save"
  | "invalid-data"
  | "unknown";

export class FirebaseOperationError extends Error {
  readonly code: FirebaseOperationErrorCode;

  constructor(code: FirebaseOperationErrorCode, message: string) {
    super(message);
    this.name = "FirebaseOperationError";
    this.code = code;
  }
}

export function normalizeFirebaseError(
  error: unknown,
  fallbackCode: FirebaseOperationErrorCode = "unknown",
): FirebaseOperationError {
  if (error instanceof FirebaseOperationError) {
    return error;
  }

  const firebaseCode =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";

  if (firebaseCode.includes("permission-denied")) {
    return new FirebaseOperationError(
      "permission-denied",
      "Firebase denied access to this account data. Check the account and Firestore Rules.",
    );
  }

  if (firebaseCode.includes("network-request-failed") || firebaseCode.includes("unavailable")) {
    return new FirebaseOperationError(
      "network",
      "Firebase could not be reached. Check your connection and try again.",
    );
  }

  if (firebaseCode.includes("email-already-in-use")) {
    return new FirebaseOperationError(
      "email-in-use",
      "An account already exists for this email address. Try signing in instead.",
    );
  }

  if (
    firebaseCode.includes("invalid-credential") ||
    firebaseCode.includes("user-not-found") ||
    firebaseCode.includes("wrong-password") ||
    firebaseCode.includes("invalid-email")
  ) {
    return new FirebaseOperationError(
      "invalid-credentials",
      "The email or password could not be verified.",
    );
  }

  if (firebaseCode.includes("weak-password")) {
    return new FirebaseOperationError(
      "weak-password",
      "Firebase rejected this password. Choose a longer password and try again.",
    );
  }

  if (firebaseCode.includes("too-many-requests")) {
    return new FirebaseOperationError(
      "too-many-requests",
      "Too many attempts were made. Wait a while before trying again.",
    );
  }

  if (firebaseCode.includes("operation-not-allowed")) {
    return new FirebaseOperationError(
      "method-disabled",
      "This sign-in method is disabled for this Firebase project. Enable Email/Password or Google in Firebase Authentication settings.",
    );
  }

  if (
    firebaseCode.includes("popup-closed-by-user") ||
    firebaseCode.includes("cancelled-popup-request")
  ) {
    return new FirebaseOperationError(
      "popup-cancelled",
      "Google sign-in was canceled. Try again when you are ready.",
    );
  }

  if (firebaseCode.includes("popup-blocked")) {
    return new FirebaseOperationError(
      "popup-blocked",
      "The Google sign-in popup was blocked. Allow popups for this site or try again.",
    );
  }

  if (firebaseCode.includes("account-exists-with-different-credential")) {
    return new FirebaseOperationError(
      "account-conflict",
      "An account already uses this email with a different sign-in method. Sign in with that method first, then link Google from your account settings.",
    );
  }

  if (
    firebaseCode.includes("invalid-api-key") ||
    firebaseCode.includes("app-not-authorized") ||
    firebaseCode.includes("unauthorized-domain")
  ) {
    return new FirebaseOperationError(
      "configuration",
      "Firebase rejected this app configuration or authorized domain. Check the Web App settings and Firebase Auth authorized domains.",
    );
  }

  const messages: Record<FirebaseOperationErrorCode, string> = {
    "not-configured": "Firebase is not configured for this build.",
    network: "Firebase could not be reached. Check your connection and try again.",
    "permission-denied": "Firebase denied access to this account data.",
    "invalid-credentials": "The email or password could not be verified.",
    "email-method-disabled": "Email/Password sign-in is disabled in Firebase Authentication settings.",
    "method-disabled": "This sign-in method is disabled in Firebase Authentication settings.",
    "popup-cancelled": "Google sign-in was canceled.",
    "popup-blocked": "The Google sign-in popup was blocked.",
    "account-conflict": "This email is already linked to a different sign-in method.",
    configuration: "Check the Firebase Web App settings and authorized domains.",
    "email-in-use": "An account already exists for this email address.",
    "weak-password": "Choose a longer password and try again.",
    "too-many-requests": "Too many attempts were made. Wait before trying again.",
    "profile-initialization":
      "The account was authenticated, but its participant profile could not be initialized. Retry profile setup.",
    "account-load":
      "Authentication succeeded, but this account's Firestore data could not be loaded. Retry loading account data.",
    "sync-disabled":
      "Cloud synchronization is turned off. No activity or session data was written.",
    "partial-save":
      "Some account data was saved, but the Digital Twin snapshot could not be updated. Refresh the account data and retry if needed.",
    "invalid-data":
      "Firebase returned account data that does not match the supported participant schema.",
    unknown: "The Firebase operation could not be completed. Try again.",
  };

  return new FirebaseOperationError(fallbackCode, messages[fallbackCode]);
}
