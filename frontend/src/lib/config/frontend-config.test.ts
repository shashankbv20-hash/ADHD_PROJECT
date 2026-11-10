import { describe, expect, it } from "vitest";

import { parseFrontendConfig } from "@/lib/config/frontend-config";

const firebaseEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "test-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "test-project",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123:web:abc",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123",
};

function invalidMessage(env: Parameters<typeof parseFrontendConfig>[0]): string {
  const config = parseFrontendConfig(env);
  expect(config.valid).toBe(false);
  return config.valid ? "" : config.error;
}

describe("parseFrontendConfig", () => {
  it("defaults to the demo provider", () => {
    expect(parseFrontendConfig({})).toMatchObject({ valid: true, provider: "demo", apiBaseUrl: null });
  });

  it("normalizes provider case and whitespace", () => {
    expect(parseFrontendConfig({ NEXT_PUBLIC_DATA_PROVIDER: "  DEMO " })).toMatchObject({
      valid: true,
      provider: "demo",
    });
  });

  it("rejects unknown providers instead of falling back", () => {
    expect(invalidMessage({ NEXT_PUBLIC_DATA_PROVIDER: "postgres" })).toMatch(/must be 'demo'/);
  });

  describe("remote mode", () => {
    it("accepts a base URL and strips the trailing slash", () => {
      expect(
        parseFrontendConfig({
          NEXT_PUBLIC_DATA_PROVIDER: "remote",
          NEXT_PUBLIC_API_BASE_URL: "https://api.example.test/",
        }),
      ).toMatchObject({ valid: true, provider: "remote", apiBaseUrl: "https://api.example.test" });
    });

    it("allows remote mode without a URL (reported as not-configured at runtime)", () => {
      expect(parseFrontendConfig({ NEXT_PUBLIC_DATA_PROVIDER: "remote" })).toMatchObject({
        valid: true,
        apiBaseUrl: null,
      });
    });

    it.each([
      ["not a url", /absolute HTTP or HTTPS/],
      ["ftp://example.test", /HTTP or HTTPS/],
      ["https://user:secret@example.test", /credentials/],
      ["https://example.test/?token=x", /query string or fragment/],
      ["https://example.test/#frag", /query string or fragment/],
    ])("rejects %s", (url, message) => {
      expect(invalidMessage({ NEXT_PUBLIC_DATA_PROVIDER: "remote", NEXT_PUBLIC_API_BASE_URL: url })).toMatch(
        message,
      );
    });

    it("ignores an invalid base URL outside remote mode", () => {
      expect(
        parseFrontendConfig({ NEXT_PUBLIC_DATA_PROVIDER: "demo", NEXT_PUBLIC_API_BASE_URL: "nonsense" }),
      ).toMatchObject({ valid: true, apiBaseUrl: null });
    });
  });

  describe("firebase mode", () => {
    it("builds the web config from public values", () => {
      const config = parseFrontendConfig({ NEXT_PUBLIC_DATA_PROVIDER: "firebase", ...firebaseEnv });
      expect(config).toMatchObject({
        valid: true,
        provider: "firebase",
        firebaseConfig: { projectId: "test-project", apiKey: "test-key" },
      });
    });

    it("lists every missing Firebase value by name", () => {
      const message = invalidMessage({ NEXT_PUBLIC_DATA_PROVIDER: "firebase" });
      for (const name of [
        "NEXT_PUBLIC_FIREBASE_API_KEY",
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        "NEXT_PUBLIC_FIREBASE_APP_ID",
        "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      ]) {
        expect(message).toContain(name);
      }
    });

    it("treats whitespace-only values as missing", () => {
      expect(
        invalidMessage({
          NEXT_PUBLIC_DATA_PROVIDER: "firebase",
          ...firebaseEnv,
          NEXT_PUBLIC_FIREBASE_API_KEY: "   ",
        }),
      ).toContain("NEXT_PUBLIC_FIREBASE_API_KEY");
    });

    it("does not expose Firebase config in other modes", () => {
      expect(parseFrontendConfig({ ...firebaseEnv })).toMatchObject({ firebaseConfig: null });
    });
  });
});
