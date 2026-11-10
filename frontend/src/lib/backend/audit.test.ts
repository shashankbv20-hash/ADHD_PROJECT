import { describe, expect, it } from "vitest";

import {
  ERASURE_CONFIRMATION_PHRASE,
  exportFilename,
  humanizeAction,
  parseAuditEvent,
} from "@/lib/backend/audit";

describe("humanizeAction", () => {
  it("uses plain-language labels for known actions", () => {
    expect(humanizeAction("consent_granted")).toBe("Research consent granted");
    expect(humanizeAction("subject_data_erased")).toBe("Research data erased");
    expect(humanizeAction("subject_access_denied")).toMatch(/refused/i);
  });

  it("humanizes unknown actions instead of hiding them", () => {
    expect(humanizeAction("some_new_backend_action")).toBe("Some new backend action");
    expect(humanizeAction("")).toBe("Unknown action");
  });
});

describe("parseAuditEvent", () => {
  const base = {
    id: "e1",
    action: "consent_granted",
    resourceType: "consent_record",
    createdAt: "2026-01-01T00:00:00Z",
    details: {},
  };

  it("marks the participant's own actions as theirs", () => {
    expect(parseAuditEvent({ ...base, actorIsYou: true })).toMatchObject({
      label: "Research consent granted",
      byYou: true,
      attention: false,
      at: "2026-01-01T00:00:00Z",
    });
  });

  it("flags actions by any other account for attention", () => {
    expect(parseAuditEvent({ ...base, action: "subject_access_denied", actorIsYou: false })).toMatchObject({
      byYou: false,
      attention: true,
    });
  });

  it("keeps the raw action for support", () => {
    expect(parseAuditEvent({ ...base, actorIsYou: true }).rawAction).toBe("consent_granted");
  });
});

describe("export and erasure helpers", () => {
  it("builds a dated, filesystem-safe export filename", () => {
    expect(exportFilename(new Date("2026-03-09T23:59:59Z"))).toBe("attune-data-export-20260309.json");
  });

  it("uses the exact confirmation phrase the backend requires", () => {
    expect(ERASURE_CONFIRMATION_PHRASE).toBe("ERASE MY DATA");
  });
});
