import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

const ALICE = "alice";
const BOB = "bob";

beforeAll(async () => {
  // Denied writes are the point of these tests; keep the SDK's error logging out of the output.
  setLogLevel("silent");
  env = await initializeTestEnvironment({
    projectId: "demo-attune-rules",
    firestore: {
      // Host and port come from FIRESTORE_EMULATOR_HOST, set by `emulators:exec`.
      rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const alice = () => env.authenticatedContext(ALICE).firestore();
const bob = () => env.authenticatedContext(BOB).firestore();
const anon = () => env.unauthenticatedContext().firestore();

function profile(overrides: Record<string, unknown> = {}) {
  return {
    uid: ALICE,
    displayName: "Alice",
    role: "participant",
    cloudSyncEnabled: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

async function seedProfile(uid: string, cloudSyncEnabled: boolean) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", uid), {
      uid,
      displayName: uid,
      role: "participant",
      cloudSyncEnabled,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
}

function cptSummary(overrides: Record<string, unknown> = {}) {
  return {
    activityId: "cpt",
    mode: "scored",
    completedAt: Timestamp.now(),
    schemaVersion: 1,
    dataProvenance: "frontend-cpt-demo-v1",
    trialCount: 24,
    targetCount: 6,
    nonTargetCount: 18,
    responseCount: 6,
    hitCount: 5,
    missCount: 1,
    falseAlarmCount: 1,
    correctRejectionCount: 17,
    accuracyPercent: 92,
    meanHitReactionTimeMs: 400,
    validReactionTimeCount: 5,
    hitReactionTimeTotalMs: 2000,
    ...overrides,
  };
}

describe("users/{uid}", () => {
  it("lets a user create only their own participant profile", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users", ALICE), profile()));
    await assertFails(setDoc(doc(bob(), "users", ALICE), profile()));
    await assertFails(setDoc(doc(anon(), "users", ALICE), profile()));
  });

  it("refuses self-assigned roles and cloud sync on create", async () => {
    await assertFails(setDoc(doc(alice(), "users", ALICE), profile({ role: "clinician" })));
    await assertFails(setDoc(doc(alice(), "users", ALICE), profile({ role: "admin" })));
    await assertFails(setDoc(doc(alice(), "users", ALICE), profile({ cloudSyncEnabled: true })));
  });

  it("refuses extra fields", async () => {
    await assertFails(setDoc(doc(alice(), "users", ALICE), profile({ isAdmin: true })));
  });

  it("allows toggling cloud sync but not changing role, uid or createdAt", async () => {
    await seedProfile(ALICE, false);
    const ref = doc(alice(), "users", ALICE);
    await assertSucceeds(updateDoc(ref, { cloudSyncEnabled: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { role: "clinician", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { uid: BOB, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { createdAt: Timestamp.now(), updatedAt: serverTimestamp() }));
  });

  it("allows reading only your own profile, never listing, never deleting", async () => {
    await seedProfile(ALICE, false);
    await assertSucceeds(getDoc(doc(alice(), "users", ALICE)));
    await assertFails(getDoc(doc(bob(), "users", ALICE)));
    await assertFails(getDoc(doc(anon(), "users", ALICE)));
    await assertFails(getDocs(collection(alice(), "users")));
    await assertFails(deleteDoc(doc(alice(), "users", ALICE)));
  });
});

describe("users/{uid}/activityRuns", () => {
  it("requires cloud sync to be enabled to write", async () => {
    await seedProfile(ALICE, false);
    await assertFails(setDoc(doc(alice(), "users", ALICE, "activityRuns", "r1"), cptSummary()));
    await seedProfile(ALICE, true);
    await assertSucceeds(setDoc(doc(alice(), "users", ALICE, "activityRuns", "r1"), cptSummary()));
  });

  it("rejects inconsistent or unexpected summary data", async () => {
    await seedProfile(ALICE, true);
    const ref = (id: string) => doc(alice(), "users", ALICE, "activityRuns", id);
    await assertFails(setDoc(ref("bad1"), cptSummary({ hitCount: 6 }))); // hits + misses != targets
    await assertFails(setDoc(ref("bad2"), cptSummary({ trialCount: 100 })));
    await assertFails(setDoc(ref("bad3"), cptSummary({ meanHitReactionTimeMs: 5000 })));
    await assertFails(setDoc(ref("bad4"), cptSummary({ mode: "practice" })));
    await assertFails(setDoc(ref("bad5"), cptSummary({ notes: "free text" })));
  });

  it("is immutable once written and owner-readable only", async () => {
    await seedProfile(ALICE, true);
    const ref = doc(alice(), "users", ALICE, "activityRuns", "r1");
    await assertSucceeds(setDoc(ref, cptSummary()));
    await assertFails(updateDoc(ref, { accuracyPercent: 100 }));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(getDoc(ref));
    await assertFails(getDoc(doc(bob(), "users", ALICE, "activityRuns", "r1")));
    await assertFails(getDocs(collection(bob(), "users", ALICE, "activityRuns")));
  });

  it("cannot be written into another user's tree", async () => {
    await seedProfile(ALICE, true);
    await seedProfile(BOB, true);
    await assertFails(setDoc(doc(bob(), "users", ALICE, "activityRuns", "r1"), cptSummary()));
  });
});

describe("other paths", () => {
  it("denies everything outside the participant tree (including backend collections)", async () => {
    for (const path of [
      ["subjects", "s1"],
      ["auditEvents", "a1"],
      ["caregiverSubjectIndex", ALICE],
      ["sessionIdempotency", "k1"],
    ] as const) {
      const ref = doc(alice(), path[0], path[1]);
      await assertFails(getDoc(ref));
      await assertFails(setDoc(ref, { x: 1 }));
    }
  });
});
