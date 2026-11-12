import { getApps, initializeApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { resolveEmulatorEndpoints } from "@/lib/firebase/emulator-config";

export interface FirebaseClientServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let cachedServices: FirebaseClientServices | null = null;

export function getFirebaseClientServices(): FirebaseClientServices | null {
  if (cachedServices) {
    return cachedServices;
  }

  const config = getFrontendConfig();

  if (!config.valid || config.provider !== "firebase" || !config.firebaseConfig) {
    return null;
  }

  const appName = "attune-frontend";
  const existingApp = getApps().find((app) => app.name === appName);
  const app = existingApp ?? initializeApp(config.firebaseConfig, appName);

  const auth = getAuth(app);
  const db = getFirestore(app);

  // Live end-to-end tests only; inert (and refused for non-demo projects) otherwise.
  // Each NEXT_PUBLIC_ variable is referenced literally so Next can inline it at build time.
  const emulators = existingApp
    ? null
    : resolveEmulatorEndpoints({
        NEXT_PUBLIC_FIREBASE_EMULATORS: process.env.NEXT_PUBLIC_FIREBASE_EMULATORS,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
        NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST:
          process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST,
      });

  if (emulators) {
    connectAuthEmulator(auth, emulators.auth.url, { disableWarnings: true });
    connectFirestoreEmulator(db, emulators.firestore.host, emulators.firestore.port);
  }

  cachedServices = { app, auth, db };

  return cachedServices;
}
