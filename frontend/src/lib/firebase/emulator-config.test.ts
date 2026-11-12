import { describe, expect, it } from "vitest";
import { resolveEmulatorEndpoints } from "./emulator-config";

const base = { NEXT_PUBLIC_FIREBASE_EMULATORS: "1", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-attune-live" };

describe("resolveEmulatorEndpoints", () => {
  it("is off unless explicitly enabled", () => {
    expect(resolveEmulatorEndpoints({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-x" })).toBeNull();
    expect(resolveEmulatorEndpoints({ ...base, NEXT_PUBLIC_FIREBASE_EMULATORS: "true" })).toBeNull();
  });

  it("refuses projects that are not demo- projects", () => {
    expect(resolveEmulatorEndpoints({ ...base, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "my-real-project" })).toBeNull();
    expect(resolveEmulatorEndpoints({ NEXT_PUBLIC_FIREBASE_EMULATORS: "1" })).toBeNull();
  });

  it("uses default loopback ports", () => {
    expect(resolveEmulatorEndpoints(base)).toEqual({
      auth: { url: "http://127.0.0.1:9099" },
      firestore: { host: "127.0.0.1", port: 8080 },
    });
  });

  it("accepts custom loopback hosts and ports", () => {
    expect(
      resolveEmulatorEndpoints({
        ...base,
        NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "http://localhost:9199",
        NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST: "127.0.0.1:8181",
      }),
    ).toEqual({ auth: { url: "http://localhost:9199" }, firestore: { host: "127.0.0.1", port: 8181 } });
  });

  it("refuses non-loopback hosts and bad ports", () => {
    expect(resolveEmulatorEndpoints({ ...base, NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "evil.example.com:9099" })).toBeNull();
    expect(resolveEmulatorEndpoints({ ...base, NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST: "127.0.0.1:abc" })).toBeNull();
  });
});
