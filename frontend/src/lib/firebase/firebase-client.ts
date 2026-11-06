import { getApps, initializeApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { getFrontendConfig } from "@/lib/config/frontend-config";

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

  cachedServices = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
  };

  return cachedServices;
}
