import { describe, expect, it, vi } from "vitest";

import type { BackendClient } from "@/lib/backend/client";
import {
  createCaregiverSharing,
  createCaregiverViewer,
  maskId,
  parseCaregiverShare,
  parseSharedSubject,
  validateCaregiverId,
} from "@/lib/backend/caregiver";
import type { BackendCaregiverRelationship } from "@/lib/backend/types";

const relationship = (overrides: Partial<BackendCaregiverRelationship> = {}): BackendCaregiverRelationship => ({
  id: "rel-1",
  caregiverUserId: "caregiver-test-uid-abcdef123456",
  subjectId: "subject-1",
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
  revokedAt: null,
  ...overrides,
});

describe("validateCaregiverId", () => {
  it("accepts typical Firebase and emulator-style IDs, ignoring surrounding spaces", () => {
    expect(validateCaregiverId("  AbC123xyz_-  ")).toBeUndefined();
    expect(validateCaregiverId("a".repeat(28))).toBeUndefined();
    expect(validateCaregiverId("a".repeat(128))).toBeUndefined();
  });

  it.each(["", "   ", "short", "has space inside-id", "bad/slash/chars", "emoji-😀-id", "a".repeat(129)])(
    "rejects %j",
    (value) => {
      expect(validateCaregiverId(value)).toBeDefined();
    },
  );
});

describe("maskId", () => {
  it("shows enough to recognise an ID without printing it in full", () => {
    expect(maskId("caregiver-test-uid-abcdef123456")).toBe("care…3456");
    expect(maskId("short")).toBe("short");
  });
});

describe("parseCaregiverShare", () => {
  it("marks active shares and hides the full caregiver ID", () => {
    const share = parseCaregiverShare(relationship());

    expect(share).toMatchObject({ id: "rel-1", active: true, revokedAt: null });
    expect(share.caregiverIdMasked).not.toContain("uid-abcdef");
  });

  it("treats revoked shares as inactive", () => {
    expect(parseCaregiverShare(relationship({ status: "revoked", revokedAt: "2026-02-01T00:00:00Z" }))).toMatchObject({
      active: false,
      revokedAt: "2026-02-01T00:00:00Z",
    });
  });

  it("does not treat a share with a revocation time as active even if the status is stale", () => {
    expect(parseCaregiverShare(relationship({ revokedAt: "2026-02-01T00:00:00Z" })).active).toBe(false);
  });
});

describe("createCaregiverSharing (owner side)", () => {
  function setup() {
    const client = {
      listCaregivers: vi.fn(async () => ({ items: [relationship(), relationship({ id: "rel-2", status: "revoked", revokedAt: "x" })] })),
      grantCaregiver: vi.fn(async () => relationship()),
      revokeCaregiver: vi.fn(async () => relationship({ status: "revoked", revokedAt: "2026-02-01T00:00:00Z" })),
    };
    return { client, sharing: createCaregiverSharing(client as unknown as BackendClient) };
  }

  it("lists shares", async () => {
    const { sharing } = setup();

    const shares = await sharing.list("subject-1");

    expect(shares.map((share) => share.active)).toEqual([true, false]);
  });

  it("validates and trims the ID before calling the backend", async () => {
    const { sharing, client } = setup();

    await sharing.share("subject-1", "  caregiver-test-uid-abcdef123456  ");
    await expect(sharing.share("subject-1", "nope")).rejects.toThrow(/caregiver ID/i);

    expect(client.grantCaregiver).toHaveBeenCalledTimes(1);
    expect(client.grantCaregiver).toHaveBeenCalledWith("subject-1", "caregiver-test-uid-abcdef123456");
  });

  it("stops a share by relationship ID", async () => {
    const { sharing, client } = setup();

    const stopped = await sharing.stop("subject-1", "rel-1");

    expect(client.revokeCaregiver).toHaveBeenCalledWith("subject-1", "rel-1");
    expect(stopped.active).toBe(false);
  });
});

describe("createCaregiverViewer (caregiver side)", () => {
  const summary = {
    id: "summary-1",
    sessionActivityId: "assignment-1",
    subjectId: "subject-1",
    activityCode: "cpt",
    dataProvenance: "p",
    calculationVersion: "v",
    createdAt: "2026-01-03T00:00:00Z",
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
      dataProvenance: "p",
      calculationVersion: "v",
    },
  };

  function setup() {
    const client = {
      listSharedSubjects: vi.fn(async () => ({
        items: [
          { subjectId: "s1", displayLabel: "Sam", relationshipId: "r1", sharedSince: "2026-01-01T00:00:00Z" },
          { subjectId: "s2", displayLabel: null, relationshipId: "r2", sharedSince: null },
          { subjectId: "s3", displayLabel: "   ", relationshipId: "r3", sharedSince: null },
        ],
      })),
      getDigitalTwin: vi.fn(async () => ({
        subjectId: "s1",
        version: 1,
        status: "insufficient_data" as const,
        profile: { summary_count: 1, metrics: { accuracy_percent: 100 } },
        qualityFlags: ["fewer_than_two_scored_observations"],
        updatedAt: null,
      })),
      listDigitalTwinHistory: vi.fn(async () => ({ items: [] })),
      listReports: vi.fn(async () => ({ items: [] })),
      listActivitySummaries: vi.fn(async () => ({ items: [summary], nextCursor: null })),
      listSessions: vi.fn(async () => ({ items: [{}, {}], nextCursor: null })),
      revokeCaregiver: vi.fn(async () => relationship({ status: "revoked", revokedAt: "x" })),
    };
    return { client, viewer: createCaregiverViewer(client as unknown as BackendClient) };
  }

  it("labels shared participants, with a neutral fallback that never invents a name", async () => {
    const { viewer } = setup();

    const shared = await viewer.listShared();

    expect(shared.map((item) => item.label)).toEqual(["Sam", "Shared participant 2", "Shared participant 3"]);
    expect(shared[0]).toMatchObject({ subjectId: "s1", relationshipId: "r1" });
  });

  it("loads a read-only view: twin, history, reports, summary-only runs and a session count", async () => {
    const { viewer } = setup();

    const data = await viewer.loadSubject("s1");

    expect(data.twin).toMatchObject({ version: 1, summaryCount: 1 });
    expect(data.runs).toHaveLength(1);
    expect(data.runs[0]).toMatchObject({ id: "assignment-1", participantId: "s1", accuracyPercent: 100, events: [] });
    expect(data.sessionCount).toBe(2);
  });

  it("only ever calls read endpoints when loading", async () => {
    const { viewer, client } = setup();

    await viewer.loadSubject("s1");

    expect(client.revokeCaregiver).not.toHaveBeenCalled();
    expect(Object.keys(client)).not.toContain("exportSubjectData");
    expect(Object.keys(client)).not.toContain("eraseSubjectData");
  });

  it("stops viewing through the relationship the backend gave the caregiver", async () => {
    const { viewer, client } = setup();

    await viewer.stopViewing("s1", "r1");

    expect(client.revokeCaregiver).toHaveBeenCalledWith("s1", "r1");
  });
});

describe("parseSharedSubject", () => {
  it("falls back to a numbered label when the owner set none", () => {
    expect(
      parseSharedSubject({ subjectId: "a", displayLabel: null, relationshipId: "r", sharedSince: null }, 0).label,
    ).toBe("Shared participant 1");
  });
});
