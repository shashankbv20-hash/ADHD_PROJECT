import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import type { BackendClient } from "@/lib/backend/client";
import {
  cptSessionIdempotencyKey,
  syncScoredCptRun,
  toBackendEvents,
} from "@/lib/backend/cpt-sync";
import type {
  BackendActivitySummary,
  BackendConsent,
  BackendSession,
  BackendSubject,
} from "@/lib/backend/types";
import { CPT_SCORED_TRIALS } from "@/features/activities/cpt/cpt-config";
import { buildCptRunSummary, createCptTrialEvent } from "@/features/activities/cpt/scoring";

const subject: BackendSubject = {
  id: "subject-1",
  displayLabel: null,
  ownerUserId: "uid-1",
  createdAt: "2026-01-01T00:00:00Z",
  isActive: true,
};

const grantedConsent: BackendConsent = {
  id: "consent-1",
  subjectId: "subject-1",
  actorUserId: "uid-1",
  scope: "research",
  version: "v1",
  idempotencyKey: "consent-key-1",
  status: "granted",
  grantedAt: "2026-01-01T00:00:00Z",
  withdrawnAt: null,
  createdAt: "2026-01-01T00:00:00Z",
};

function session(
  overrides: Partial<BackendSession> = {},
  activityStatus: BackendSession["activities"][number]["status"] = "assigned",
): BackendSession {
  return {
    id: "session-1",
    subjectId: "subject-1",
    status: "created",
    createdAt: "2026-01-01T00:00:00Z",
    startedAt: null,
    completedAt: null,
    activities: [
      {
        id: "assignment-1",
        activityCode: "cpt",
        position: 0,
        status: activityStatus,
        mode: "scored",
        startedAt: null,
        completedAt: null,
      },
    ],
    ...overrides,
  };
}

const summary = { id: "sum-1", sessionActivityId: "assignment-1" } as BackendActivitySummary;

function makeRun(mode: "practice" | "scored" = "scored") {
  const events = CPT_SCORED_TRIALS.map((trial, index) =>
    createCptTrialEvent(trial, index, {
      responded: trial.isTarget,
      reactionTimeMs: trial.isTarget ? 400 : null,
    }),
  );
  return buildCptRunSummary({
    id: "run-abc123",
    participantId: "uid-1",
    mode,
    completedAt: "2026-01-01T00:00:00Z",
    events,
  });
}

function fakeClient(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const track = <T>(name: string, value: T) =>
    vi.fn(async () => {
      calls.push(name);
      return value;
    });

  const client = {
    listSubjects: track("listSubjects", { items: [subject] }),
    createSubject: track("createSubject", subject),
    listConsents: track("listConsents", { items: [grantedConsent] }),
    createConsent: track("createConsent", grantedConsent),
    createSession: track("createSession", session()),
    startSession: track("startSession", session({ status: "active" })),
    startActivity: track("startActivity", session({ status: "active" }, "active")),
    ingestEvents: track("ingestEvents", { acceptedCount: 24, duplicateCount: 0, totalEventCount: 24 }),
    completeActivity: track("completeActivity", session({ status: "completed" }, "completed")),
    getSessionSummaries: track("getSessionSummaries", [summary]),
    ...overrides,
  };

  return { client: client as unknown as BackendClient, mocks: client, calls };
}

describe("syncScoredCptRun", () => {
  it("runs the full lifecycle in order and returns the server-calculated summary", async () => {
    const { client, calls } = fakeClient();

    const result = await syncScoredCptRun(client, makeRun());

    expect(result).toEqual({
      status: "synced",
      sessionId: "session-1",
      subjectId: "subject-1",
      summary,
    });
    expect(calls).toEqual([
      "listSubjects",
      "listConsents",
      "createSession",
      "startSession",
      "startActivity",
      "ingestEvents",
      "completeActivity",
      "getSessionSummaries",
    ]);
  });

  it("sends trial events only, never client-calculated metrics", async () => {
    const { client, mocks } = fakeClient();

    await syncScoredCptRun(client, makeRun());

    const [, , events] = (mocks.ingestEvents as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(events).toHaveLength(24);
    expect(Object.keys(events[0]).sort()).toEqual(
      ["isTarget", "outcome", "reactionTimeMs", "responded", "stimulus", "trialId", "trialIndex"].sort(),
    );
    const createBody = (mocks.createSession as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createBody).toEqual({
      subjectId: "subject-1",
      activities: [{ activityCode: "cpt", mode: "scored" }],
      idempotencyKey: cptSessionIdempotencyKey("run-abc123"),
    });
  });

  it("returns consent-required without creating anything when consent is missing", async () => {
    const { client, calls } = fakeClient({
      listConsents: vi.fn(async () => ({
        items: [{ ...grantedConsent, status: "withdrawn" as const }],
      })),
    });

    const result = await syncScoredCptRun(client, makeRun());

    expect(result).toEqual({ status: "consent-required", subjectId: "subject-1" });
    expect(calls).toEqual(["listSubjects"]);
  });

  it("never grants consent itself", async () => {
    const { client, mocks } = fakeClient({ listConsents: vi.fn(async () => ({ items: [] })) });

    await syncScoredCptRun(client, makeRun());

    expect(mocks.createConsent).not.toHaveBeenCalled();
  });

  it("treats a consent_required response (withdrawn mid-sync) as consent-required", async () => {
    const { client } = fakeClient({
      createSession: vi.fn(async () => {
        throw new ApiError("forbidden", 403, "http-request-failed", { backendCode: "consent_required" });
      }),
    });

    await expect(syncScoredCptRun(client, makeRun())).resolves.toEqual({
      status: "consent-required",
      subjectId: "subject-1",
    });
  });

  it("propagates other API failures so the caller can retry", async () => {
    const { client } = fakeClient({
      ingestEvents: vi.fn(async () => {
        throw new ApiError("unavailable", 503, "http-request-failed", { backendCode: "firestore_unavailable" });
      }),
    });

    await expect(syncScoredCptRun(client, makeRun())).rejects.toMatchObject({ status: 503 });
  });

  it("does not create a subject and asks for consent when none exists yet", async () => {
    const { client, mocks, calls } = fakeClient({ listSubjects: vi.fn(async () => ({ items: [] })) });

    const result = await syncScoredCptRun(client, makeRun());

    expect(result).toEqual({ status: "consent-required", subjectId: null });
    expect(mocks.createSubject).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("ignores inactive subjects and still creates nothing", async () => {
    const { client, mocks } = fakeClient({
      listSubjects: vi.fn(async () => ({ items: [{ ...subject, isActive: false }] })),
    });

    const result = await syncScoredCptRun(client, makeRun());

    expect(result.status).toBe("consent-required");
    expect(mocks.createSubject).not.toHaveBeenCalled();
  });

  it("resumes an already-started session without repeating transitions", async () => {
    const { client, mocks } = fakeClient({
      createSession: vi.fn(async () => session({ status: "active" }, "active")),
    });

    await syncScoredCptRun(client, makeRun());

    expect(mocks.startSession).not.toHaveBeenCalled();
    expect(mocks.startActivity).not.toHaveBeenCalled();
    expect(mocks.ingestEvents).toHaveBeenCalledTimes(1);
    expect(mocks.completeActivity).toHaveBeenCalledTimes(1);
  });

  it("does not resend events for an already-completed activity", async () => {
    const { client, mocks } = fakeClient({
      createSession: vi.fn(async () => session({ status: "completed" }, "completed")),
    });

    const result = await syncScoredCptRun(client, makeRun());

    expect(result.status).toBe("synced");
    expect(mocks.ingestEvents).not.toHaveBeenCalled();
    expect(mocks.completeActivity).not.toHaveBeenCalled();
    expect(mocks.getSessionSummaries).toHaveBeenCalledTimes(1);
  });

  it("refuses to upload practice runs", async () => {
    const { client, calls } = fakeClient();

    await expect(syncScoredCptRun(client, makeRun("practice"))).rejects.toThrow(/practice/i);
    expect(calls).toEqual([]);
  });

  it("uses the same idempotency key for the same run and different keys for different runs", () => {
    expect(cptSessionIdempotencyKey("a-run-1")).toBe(cptSessionIdempotencyKey("a-run-1"));
    expect(cptSessionIdempotencyKey("a-run-1")).not.toBe(cptSessionIdempotencyKey("a-run-2"));
    expect(cptSessionIdempotencyKey("x").length).toBeGreaterThanOrEqual(8);
  });

  it("maps run events to the wire shape", () => {
    expect(toBackendEvents(makeRun())[1]).toEqual({
      trialIndex: 1,
      trialId: "cpt-scored-02",
      stimulus: "X",
      isTarget: true,
      responded: true,
      reactionTimeMs: 400,
      outcome: "hit",
    });
  });
});
