export type DataProviderMode = "demo" | "remote" | "firebase";

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId: string;
}

export type FrontendConfig =
  | {
      valid: true;
      provider: DataProviderMode;
      apiBaseUrl: string | null;
      firebaseConfig: FirebaseWebConfig | null;
    }
  | {
      valid: false;
      provider: null;
      apiBaseUrl: null;
      error: string;
    };

export interface FrontendEnvironment {
  NEXT_PUBLIC_DATA_PROVIDER?: string;
  NEXT_PUBLIC_API_BASE_URL?: string;
  NEXT_PUBLIC_FIREBASE_API_KEY?: string;
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string;
  NEXT_PUBLIC_FIREBASE_APP_ID?: string;
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string;
}

function parseApiBaseUrl(
  rawValue: string | undefined,
): { value: string | null; error?: string } {
  const value = rawValue?.trim();

  if (!value) {
    return { value: null };
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return {
      value: null,
      error: "NEXT_PUBLIC_API_BASE_URL must be an absolute HTTP or HTTPS URL.",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      value: null,
      error: "NEXT_PUBLIC_API_BASE_URL must use HTTP or HTTPS.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      value: null,
      error:
        "Do not put credentials in NEXT_PUBLIC_API_BASE_URL; browser-visible URLs must not contain secrets.",
    };
  }

  if (parsed.search || parsed.hash) {
    return {
      value: null,
      error:
        "NEXT_PUBLIC_API_BASE_URL must not contain a query string or fragment.",
    };
  }

  return { value: parsed.toString().replace(/\/$/, "") };
}

export function parseFrontendConfig(
  environment: FrontendEnvironment,
): FrontendConfig {
  const rawProvider = environment.NEXT_PUBLIC_DATA_PROVIDER?.trim().toLowerCase();
  const provider = rawProvider || "demo";

  if (provider !== "demo" && provider !== "remote" && provider !== "firebase") {
    return {
      valid: false,
      provider: null,
      apiBaseUrl: null,
      error:
        "NEXT_PUBLIC_DATA_PROVIDER must be 'demo', 'firebase', or 'remote'. No provider was selected.",
    };
  }

  const parsedApiBaseUrl = parseApiBaseUrl(
    environment.NEXT_PUBLIC_API_BASE_URL,
  );

  const firebaseConfigValues = {
    apiKey: environment.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
    authDomain: environment.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
    appId: environment.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
    messagingSenderId:
      environment.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  };

  if (provider === "firebase") {
    const missingFirebaseValues = Object.entries(firebaseConfigValues)
      .filter(([, value]) => !value)
      .map(([key]) => `NEXT_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`);

    if (missingFirebaseValues.length > 0) {
      return {
        valid: false,
        provider: null,
        apiBaseUrl: null,
        error: `Firebase mode needs these public Web App values: ${missingFirebaseValues.join(", ")}.`,
      };
    }
  }

  if (provider === "remote" && parsedApiBaseUrl.error) {
    return {
      valid: false,
      provider: null,
      apiBaseUrl: null,
      error: parsedApiBaseUrl.error,
    };
  }

  return {
    valid: true,
    provider,
    apiBaseUrl: provider === "remote" ? parsedApiBaseUrl.value : null,
    firebaseConfig:
      provider === "firebase"
        ? {
            apiKey: firebaseConfigValues.apiKey!,
            authDomain: firebaseConfigValues.authDomain!,
            projectId: firebaseConfigValues.projectId!,
            appId: firebaseConfigValues.appId!,
            messagingSenderId: firebaseConfigValues.messagingSenderId!,
          }
        : null,
  };
}

export function getFrontendConfig(): FrontendConfig {
  return parseFrontendConfig({
    NEXT_PUBLIC_DATA_PROVIDER: process.env.NEXT_PUBLIC_DATA_PROVIDER,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  });
}
