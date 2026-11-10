import { defineConfig } from "vitest/config";

// Unit tests cover framework-independent logic (scoring, config, API client,
// validation). Browser/route behaviour is covered by Playwright (e2e/).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/features/activities/cpt/**/*.ts",
        "src/features/auth/validation.ts",
        "src/features/upload/validation.ts",
        "src/features/clinician/clinician-comparison-data.ts",
        "src/lib/api-client.ts",
        "src/lib/config/frontend-config.ts",
      ],
    },
  },
});
