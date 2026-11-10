import { describe, expect, it, vi } from "vitest";

import type { BackendClient } from "@/lib/backend/client";
import { createBackendSyncController } from "@/lib/backend/sync-controller";
import type { BackendAuditEvent, DataErasureResult } from "@/lib/backend/types";

const erasure: DataErasureResult = {
  subjectId: "subject-1",
  erasedAt: "2026-02-01T00:00:00Z",
  withdrawnConsentCount: 1,
  deletedDocumentCounts: { sessions: 5, activitySummaries: 2 },
};

const events: BackendAuditEvent[] = [
  {
    id: "a1",
    action: "consent_granted",
    resourceType: "consent_record",
    createdAt: "2026-01-01T00:00:00Z",
    actorIsYou: true,
    details: {},
  },
  {
    id: "a2",
    action: "subject_access_denied",
    resourceType: "subject",
    createdAt: "2026-01-02T00:00:00Z",
    actorIsYou: false,
    details: {},
  },
];

function setup() {
  const client = {
    exportSubjectData: vi.fn(async () => ({ subject: { id: "subject-1" }, sessions: [] })),
    listAuditEvents: vi.fn(async () => ({ items: events })),
    eraseSubjectData: vi.fn(async () => erasure),
  };
  const controller = createBackendSyncController({
    client: client as unknown as BackendClient,
    participantId: "uid-1",
  });
  return { client, controller };
}

describe("data rights in the sync controller", () => {
  it("serializes the export for download with a dated filename", async () => {
    const { controller, client } = setup();

    const result = await controller.exportData("subject-1", new Date("2026-04-05T10:00:00Z"));

    expect(client.exportSubjectData).toHaveBeenCalledWith("subject-1");
    expect(result.filename).toBe("attune-data-export-20260405.json");
    expect(JSON.parse(result.json)).toEqual({ subject: { id: "subject-1" }, sessions: [] });
    // Pretty-printed so a person can read it.
    expect(result.json).toContain("\n  ");
  });

  it("turns audit events into access-log entries, distinguishing other accounts", async () => {
    const { controller, client } = setup();

    const log = await controller.loadAccessLog("subject-1");

    expect(client.listAuditEvents).toHaveBeenCalledWith("subject-1", { limit: 200 });
    expect(log.map((entry) => [entry.label, entry.byYou])).toEqual([
      ["Research consent granted", true],
      ["Access to this record was refused", false],
    ]);
    expect(log[1].attention).toBe(true);
  });

  it("erases through the backend and returns its counts", async () => {
    const { controller, client } = setup();

    await expect(controller.eraseData("subject-1")).resolves.toEqual(erasure);
    expect(client.eraseSubjectData).toHaveBeenCalledWith("subject-1");
    expect(client.eraseSubjectData).toHaveBeenCalledTimes(1);
  });

  it("lets backend failures propagate so the UI can report them", async () => {
    const { controller, client } = setup();
    client.eraseSubjectData.mockRejectedValueOnce(new Error("boom"));

    await expect(controller.eraseData("subject-1")).rejects.toThrow("boom");
  });
});
