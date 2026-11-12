/**
 * Optional local-emulator wiring for the Firebase client, used only by the live end-to-end
 * tests. It is inert unless NEXT_PUBLIC_FIREBASE_EMULATORS=1, and even then it refuses to
 * connect unless the project ID starts with "demo-" (which can never reach a real project)
 * and every host is loopback, so a misconfigured build cannot point real users at an emulator
 * or send test traffic to a real service.
 */
export interface EmulatorEndpoints {
  auth: { url: string };
  firestore: { host: string; port: number };
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function parseHostPort(value: string | undefined, fallbackPort: number): { host: string; port: number } | null {
  const raw = (value?.trim() || `127.0.0.1:${fallbackPort}`).replace(/^https?:\/\//, "");
  const separator = raw.lastIndexOf(":");
  const host = separator === -1 ? raw : raw.slice(0, separator);
  const port = separator === -1 ? fallbackPort : Number(raw.slice(separator + 1));

  if (!LOOPBACK_HOSTS.has(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return { host, port };
}

export function resolveEmulatorEndpoints(environment: {
  NEXT_PUBLIC_FIREBASE_EMULATORS?: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string;
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST?: string;
  NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST?: string;
}): EmulatorEndpoints | null {
  if (environment.NEXT_PUBLIC_FIREBASE_EMULATORS !== "1") {
    return null;
  }

  if (!environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim().startsWith("demo-")) {
    return null;
  }

  const auth = parseHostPort(environment.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST, 9099);
  const firestore = parseHostPort(environment.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST, 8080);

  if (!auth || !firestore) {
    return null;
  }

  return { auth: { url: `http://${auth.host}:${auth.port}` }, firestore };
}
