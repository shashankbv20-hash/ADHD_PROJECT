import { describe, expect, it, vi } from "vitest";

import { ApiClientError, ApiError } from "@/lib/api-client";
import type { BackendClient } from "@/lib/backend/client";
import {
  RESEARCH_CONSENT_VERSION,
  newConsentIdempotencyKey,
} from "@/lib/backend/consent";
import {
  ConsentRequiredError,
  createBackendSyncController,
  describeSyncError,
} from "@/lib/backend/sync-controller";
import { summaryToCptRun } from "@/lib/backend/summary-mapping";
import type {
  BackendActivitySummary,
  BackendConsent,
  BackendSession,
  BackendSubject,
} from "@/lib/backend/types";
import { CPT_SCORED_TRIALS } from "@/features/activities/cpt/cpt-config";
import { mergeActivityRuns } from "@/features/activities/activity-session-store";
import { buildCptRunSummary, createCptTrialEvent } from "@/features/activities/cpt/scoring";

const UID = "uid-1";

const subject: BackendSubject = {
  id: "subject-1",
  displayLabel: null,
  ownerUserId: UID,
  createdAt: "2026-01-01T00:00:00Z",
  isActive: true,
};

const consent = (overrides: Partial<BackendConsent> = {}): BackendConsent => ({
  id: "consent-1",
  subjectId: "subject-1",
  actorUserId: UID,
  scope: "research",
  version: RESEARCH_CONSENT_VERSION,
  idempotencyKey: "consent-key",
  status: "granted",
  grantedAt: "2026-01-01T00:00:00Z",
  withdrawnAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const summary = (id: string, createdAt: string): BackendActivitySummary => ({
  id: `summary-${id}`,
  sessionActivityId: id,
  subjectId: "subject-1",
  activityCode: "cpt",
  dataProvenance: "frontend-cpt-demo-event-derived-v1",
  calculationVersion: "backend-cpt-scoring-v1",
  createdAt,
  metrics: {
    trialCount: 24,
    targetCount: 6,
    nonTargetCount: 18,
    responseCount: 6,
    hitCount: 6,
    missCount: 0,
    falseAlarmCount: 0,
    correctRejectionCount: 18,
    accuracyPercent: 100,
    meanHitReactionTimeMs: 400,
    hitReactionTimeStddevMs: 0,
    hitReactionTimeTotalMs: 2400,
    validReactionTimeCount: 6,
    omissionErrorCount: 0,
    commissionErrorCount: 0,
    blockMetrics: [],
    dataProvenance: "frontend-cpt-demo-event-derived-v1",
    calculationVersion: "backend-cpt-scoring-v1",
  },
});

function completedSession(): BackendSession {
  return {
    id: "session-1",
    subjectId: "subject-1",
    status: "completed",
    createdAt: "2026-01-01T00:00:00Z",
    startedAt: null,
    completedAt: null,
    activities: [
      {
        id: "assignment-1",
        activityCode: "cpt",
        position: 0,
        status: "completed",
        mode: "scored",
        startedAt: null,
        completedAt: null,
      },
    ],
  };
}

function makeRun(participantId = UID) {
  const events = CPT_SCORED_TRIALS.map((trial, index) =>
    createCptTrialEvent(trial, index, { responded: trial.isTarget, reactionTimeMs: trial.isTarget ? 400 : null }),
  );
  return buildCptRunSummary({
    id: "run-1",
    participantId,
    mode: "scored",
    completedAt: "2026-01-02T00:00:00Z",
    events,
  });
}

function fakeClient(overrides: Record<string, unknown> = {}) {
  const client = {
    listSubjects: vi.fn(async () => ({ items: [subject] })),
    createSubject: vi.fn(async () => subject),
    listConsents: vi.fn(async () => ({ items: [consent()] })),
    createConsent: vi.fn(async () => consent()),
    withdrawConsent: vi.fn(async () => consent({ status: "withdrawn" })),
    listActivitySummaries: vi.fn(async () => ({
      items: [summary("assignment-1", "2026-01-03T00:00:00Z")],
      nextCursor: null,
    })),
    createSession: vi.fn(async () => completedSession()),
    getSessionSummaries: vi.fn(async () => [summary("assignment-1", "2026-01-03T00:00:00Z")]),
    ...overrides,
  };
  return { client: client as unknown as BackendClient, mocks: client };
}

describe("backend sync controller", () => {
  describe("load", () => {
    it("is read-only: a brand-new participant creates nothing", async () => {
      const { client, mocks } = fakeClient({ listSubjects: vi.fn(async () => ({ items: [] })) });

      const snapshot = await createBackendSyncController({ client, participantId: UID }).load();

      expect(snapshot).toEqual({ subjectId: null, consent: { status: "none" }, serverRuns: [] });
      expect(mocks.createSubject).not.toHaveBeenCalled();
      expect(mocks.createConsent).not.toHaveBeenCalled();
    });

    it("reports granted consent and maps server summaries to runs", async () => {
      const { client } = fakeClient();

      const snapshot = await createBackendSyncController({ client, participantId: UID }).load();

      expect(snapshot.subjectId).toBe("subject-1");
      expect(snapshot.consent).toEqual({
        status: "granted",
        id: "consent-1",
        version: RESEARCH_CONSENT_VERSION,
      });
      expect(snapshot.serverRuns).toHaveLength(1);
      expect(snapshot.serverRuns[0]).toMatchObject({
        id: "assignment-1",
        participantId: UID,
        mode: "scored",
        accuracyPercent: 100,
        events: [],
      });
    });

    it.each(["withdrawn", "superseded", "denied"] as const)(
      "treats %s consent as not granted",
      async (status) => {
        const { client } = fakeClient({
          listConsents: vi.fn(async () => ({ items: [consent({ status })] })),
        });

        const snapshot = await createBackendSyncController({ client, participantId: UID }).load();

        expect(snapshot.consent).toEqual({ status: "none" });
      },
    );

    it("ignores consent for other scopes", async () => {
      const { client } = fakeClient({
        listConsents: vi.fn(async () => ({ items: [consent({ scope: "webcam_analysis" })] })),
      });

      const snapshot = await createBackendSyncController({ client, participantId: UID }).load();

      expect(snapshot.consent).toEqual({ status: "none" });
    });
  });

  describe("grantConsent", () => {
    it("creates the subject only here, then records versioned research consent", async () => {
      const { client, mocks } = fakeClient({ listSubjects: vi.fn(async () => ({ items: [] })) });
      const controller = createBackendSyncController({
        client,
        participantId: UID,
        newIdempotencyKey: () => "consent-key-123",
      });

      const result = await controller.grantConsent();

      expect(mocks.createSubject).toHaveBeenCalledTimes(1);
      expect(mocks.createConsent).toHaveBeenCalledWith("subject-1", {
        scope: "research",
        version: RESEARCH_CONSENT_VERSION,
        idempotencyKey: "consent-key-123",
      });
      expect(result.subjectId).toBe("subject-1");
    });

    it("reuses an existing subject", async () => {
      const { client, mocks } = fakeClient();

      await createBackendSyncController({ client, participantId: UID }).grantConsent();

      expect(mocks.createSubject).not.toHaveBeenCalled();
    });

    it("uses a fresh idempotency key per grant so consent can be re-granted after withdrawal", async () => {
      const keys = new Set<string>();
      for (let index = 0; index < 5; index += 1) {
        keys.add(newConsentIdempotencyKey());
      }
      expect(keys.size).toBe(5);
      for (const key of keys) {
        expect(key.length).toBeGreaterThanOrEqual(8);
        expect(key.length).toBeLessThanOrEqual(128);
      }
    });
  });

  describe("withdrawConsent", () => {
    it("withdraws by consent id", async () => {
      const { client, mocks } = fakeClient();

      await createBackendSyncController({ client, participantId: UID }).withdrawConsent("subject-1", "consent-1");

      expect(mocks.withdrawConsent).toHaveBeenCalledWith("subject-1", "consent-1");
    });
  });

  describe("persistRun", () => {
    it("returns the server run id that stands in for the browser run", async () => {
      const startableSession = completedSession();
      const { client } = fakeClient({ createSession: vi.fn(async () => startableSession) });

      const outcome = await createBackendSyncController({ client, participantId: UID }).persistRun(makeRun());

      expect(outcome.serverRunId).toBe("assignment-1");
      expect(outcome.message).toMatch(/research backend/i);
    });

    it("throws ConsentRequiredError, creating nothing, when consent is missing", async () => {
      const { client, mocks } = fakeClient({ listConsents: vi.fn(async () => ({ items: [] })) });
      const controller = createBackendSyncController({ client, participantId: UID });

      await expect(controller.persistRun(makeRun())).rejects.toBeInstanceOf(ConsentRequiredError);
      expect(mocks.createSession).not.toHaveBeenCalled();
      expect(mocks.createConsent).not.toHaveBeenCalled();
    });

    it("rejects runs that belong to another participant", async () => {
      const { client, mocks } = fakeClient();

      await expect(
        createBackendSyncController({ client, participantId: UID }).persistRun(makeRun("someone-else")),
      ).rejects.toThrow(/does not belong/);
      expect(mocks.listSubjects).not.toHaveBeenCalled();
    });
  });
});

describe("describeSyncError", () => {
  it("never leaks server text and includes the reference when available", () => {
    const error = new ApiError("generic", 500, "http-request-failed", { requestId: "req-9" });
    const text = describeSyncError(error);
    expect(text).toContain("req-9");
    expect(text).toMatch(/stays in this browser session/);
  });

  it("explains network failures, sign-in problems and consent separately", () => {
    expect(describeSyncError(new ApiClientError("x", { kind: "network" }))).toMatch(/could not be reached/);
    expect(describeSyncError(new ApiClientError("x", { kind: "configuration", code: "auth-token-unavailable" }))).toMatch(
      /Sign in again/,
    );
    expect(describeSyncError(new ConsentRequiredError())).toMatch(/consent/i);
    expect(describeSyncError(new Error("raw internal detail"))).not.toContain("raw internal detail");
  });
});

describe("summaryToCptRun", () => {
  it("maps server metrics and leaves the event timeline empty", () => {
    const run = summaryToCptRun(summary("a1", "2026-02-01T00:00:00Z"), UID);
    expect(run).toMatchObject({
      id: "a1",
      participantId: UID,
      activityId: "cpt",
      mode: "scored",
      completedAt: "2026-02-01T00:00:00Z",
      trialCount: 24,
      hitReactionTimeTotalMs: 2400,
    });
    expect(run.events).toEqual([]);
  });
});

describe("mergeActivityRuns with server run aliases", () => {
  const browserRun = makeRun();
  const serverRun = summaryToCptRun(summary("assignment-1", "2026-01-02T00:00:01Z"), UID);
  const otherServerRun = summaryToCptRun(summary("assignment-2", "2026-01-01T00:00:00Z"), UID);

  it("lists a saved run once, preferring the browser copy that still has trial events", () => {
    const merged = mergeActivityRuns([serverRun, otherServerRun], [browserRun], { "run-1": "assignment-1" });

    expect(merged.map((run) => run.id)).toEqual(["run-1", "assignment-2"]);
    expect(merged[0].events).toHaveLength(24);
  });

  it("shows only the server run after a reload (no browser copy)", () => {
    const merged = mergeActivityRuns([serverRun, otherServerRun], [], { "run-1": "assignment-1" });

    expect(merged.map((run) => run.id)).toEqual(["assignment-1", "assignment-2"]);
  });

  it("keeps both when the run has not been saved yet", () => {
    const merged = mergeActivityRuns([otherServerRun], [browserRun]);

    expect(merged.map((run) => run.id)).toEqual(["run-1", "assignment-2"]);
  });
});
