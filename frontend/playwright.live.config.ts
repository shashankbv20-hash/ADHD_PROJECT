import { defineConfig, devices } from "@playwright/test";

/**
 * Live signed-in end-to-end tests: the real browser UI, the real FastAPI app verifying real
 * Firebase ID tokens, and the Firebase Auth + Firestore EMULATORS. Everything is synthetic and
 * the "demo-" project ID can never reach a real Firebase project.
 *
 * Run with `npm run test:e2e:live`, which starts the emulators and exports their host
 * variables (FIREBASE_AUTH_EMULATOR_HOST, FIRESTORE_EMULATOR_HOST) before Playwright starts.
 * The backend is started with ATTUNE_PYTHON (default "python"): use the backend virtualenv.
 */
const FRONTEND_PORT = 3200;
const API_PORT = 8200;
const PROJECT_ID = "demo-attune-live";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const python = process.env.ATTUNE_PYTHON ?? "python";

export default defineConfig({
  testDir: "./e2e-live",
  fullyParallel: false,
  workers: 1,
  timeout: 900_000, // five timed tasks at 2.2 s per trial
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never", outputFolder: "playwright-report-live" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${FRONTEND_PORT}`, trace: "retain-on-failure" },
  // PLAYWRIGHT_CHANNEL=msedge (or chrome) uses an installed browser instead of the bundled Chromium.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
    },
  ],
  webServer: [
    {
      command: `"${python}" scripts/serve_e2e_app.py --port ${API_PORT} --cors-origin http://127.0.0.1:${FRONTEND_PORT}`,
      cwd: "../backend",
      url: `http://127.0.0.1:${API_PORT}/health/live`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        FIREBASE_PROJECT_ID: PROJECT_ID,
        FIREBASE_AUTH_EMULATOR_HOST: authHost,
      },
    },
    {
      command: `${process.env.E2E_SKIP_BUILD ? "" : "npm run build && "}npm run start -- --port ${FRONTEND_PORT} --hostname 127.0.0.1`,
      url: `http://127.0.0.1:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        NEXT_PUBLIC_DATA_PROVIDER: "firebase",
        NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${API_PORT}`,
        NEXT_PUBLIC_FIREBASE_API_KEY: "fake-api-key",
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT_ID}.firebaseapp.com`,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
        NEXT_PUBLIC_FIREBASE_APP_ID: "1:0:web:0",
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "0",
        NEXT_PUBLIC_FIREBASE_EMULATORS: "1",
        NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: authHost,
        NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST: firestoreHost,
      },
    },
  ],
});
