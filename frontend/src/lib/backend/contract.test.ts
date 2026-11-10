import { describe, expect, it } from "vitest";

import { CPT_SCORED_TRIALS } from "@/features/activities/cpt/cpt-config";
import { buildCptRunSummary, createCptTrialEvent } from "@/features/activities/cpt/scoring";
import { createBackendClient } from "@/lib/backend/client";
import {
  ConsentRequiredError,
  createBackendSyncController,
} from "@/lib/backend/sync-controller";

/**
 * Contract test: runs the real TypeScript client and sync controller against
 * the real FastAPI app (fake auth, in-memory store; see
 * backend/scripts/serve_test_app.py). It proves the hand-written wire types
 * match the backend and that frontend and backend CPT scoring agree.
 *
 * Skipped unless BACKEND_CONTRACT_URL is set, e.g. http://127.0.0.1:8765.
 */
const baseUrl = process.env.BACKEND_CONTRACT_URL;

function buildRun(participantId: string, runId: string, respond: (isTarget: boolean, index: number) => boolean) {
  const events = CPT_SCORED_TRIALS.map((trial, index) => {
    const responded = respond(trial.isTarget, index);
    return createCptTrialEvent(trial, index, {
      responded,
      reactionTimeMs: responded ? 350 + index * 5 : null,
    });
  });
  return buildCptRunSummary({
    id: runId,
    participantId,
    mode: "scored",
    completedAt: new Date().toISOString(),
    events,
  });
}

/** The parts of the data export these tests inspect. */
interface ExportBundle {
  subject: { id: string; data_erased_at?: unknown };
  consents: unknown[];
  sessions: { activities: { events: unknown[] }[] }[];
  activitySummaries: unknown[];
  digitalTwin: { history: unknown[] };
  reports: unknown[];
}

describe.skipIf(!baseUrl)("frontend client against the real backend", () => {
  const client = createBackendClient({
    baseUrl: baseUrl ?? "http://127.0.0.1:0",
    getIdToken: async () => "participant-token",
  });
  const participantId = "participant-test-uid";
  const controller = createBackendSyncController({ client, participantId });

  // The tests below intentionally share one backend state and run in order.
  it("reports capabilities with EEG, webcam and AI Buddy honestly unavailable", async () => {
    const capabilities = await client.getCapabilities();
    expect(capabilities.apiVersion).toBe("v1");
    expect(capabilities.eeg.available).toBe(false);
    expect(capabilities.webcam.available).toBe(false);
    expect(capabilities.aiBuddy.available).toBe(false);
  });

  it("rejects an unknown token with the vetted error code", async () => {
    const bad = createBackendClient({ baseUrl: baseUrl as string, getIdToken: async () => "nope" });
    await expect(bad.getMe()).rejects.toMatchObject({ status: 401, backendCode: "invalid_bearer_token" });
  });

  it("a new participant has no subject, no consent and no runs, and loading creates nothing", async () => {
    const before = await controller.load();
    expect(before).toEqual({
      subjectId: null,
      consent: { status: "none" },
      serverRuns: [],
      twin: null,
      twinHistory: [],
      reports: [],
      sessions: [],
    });
    expect((await client.listSubjects()).items).toHaveLength(0);
  });

  it("refuses to save a run without consent and still creates no records", async () => {
    const run = buildRun(participantId, "run-before-consent", (isTarget) => isTarget);

    await expect(controller.persistRun(run)).rejects.toBeInstanceOf(ConsentRequiredError);
    expect((await client.listSubjects()).items).toHaveLength(0);
  });

  it("grants consent explicitly, creating the subject only then", async () => {
    const { subjectId, consent } = await controller.grantConsent();

    expect(consent.status).toBe("granted");
    expect(consent.scope).toBe("research");
    expect((await client.listSubjects()).items.map((subject) => subject.id)).toEqual([subjectId]);
    expect((await controller.load()).consent.status).toBe("granted");
  });

  it("saves a scored run and the server's metrics match the frontend's own scoring", async () => {
    // Respond to every target, and false-alarm on two non-targets.
    const run = buildRun(participantId, "run-contract-1", (isTarget, index) => isTarget || index === 0 || index === 4);

    const outcome = await controller.persistRun(run);
    expect(outcome.serverRunId).toBeTruthy();

    const snapshot = await controller.load();
    const saved = snapshot.serverRuns.find((candidate) => candidate.id === outcome.serverRunId);
    expect(saved).toBeDefined();

    // Frontend (browser) scoring vs backend (server) scoring of the same events.
    expect(saved).toMatchObject({
      trialCount: run.trialCount,
      targetCount: run.targetCount,
      nonTargetCount: run.nonTargetCount,
      responseCount: run.responseCount,
      hitCount: run.hitCount,
      missCount: run.missCount,
      falseAlarmCount: run.falseAlarmCount,
      correctRejectionCount: run.correctRejectionCount,
      accuracyPercent: run.accuracyPercent,
      meanHitReactionTimeMs: run.meanHitReactionTimeMs,
      validReactionTimeCount: run.validReactionTimeCount,
      hitReactionTimeTotalMs: run.hitReactionTimeTotalMs,
    });
  });

  it("retrying the same run resumes the same server session instead of duplicating it", async () => {
    const run = buildRun(participantId, "run-contract-1", (isTarget, index) => isTarget || index === 0 || index === 4);

    const again = await controller.persistRun(run);
    const snapshot = await controller.load();

    expect(snapshot.serverRuns.filter((candidate) => candidate.id === again.serverRunId)).toHaveLength(1);
    expect(snapshot.serverRuns).toHaveLength(1);
  });

  it("a second run is saved separately and the Digital Twin becomes available", async () => {
    const run = buildRun(participantId, "run-contract-2", (isTarget) => isTarget);

    await controller.persistRun(run);
    const snapshot = await controller.load();
    expect(snapshot.serverRuns).toHaveLength(2);

    const { subjectId } = snapshot;
    const twin = await client.getDigitalTwin(subjectId as string);
    expect(twin.status).toBe("available");
    expect(twin.version).toBeGreaterThanOrEqual(1);
  });

  it("the parsed server Digital Twin matches what the backend actually returned", async () => {
    const snapshot = await controller.load();
    const twin = snapshot.twin;

    expect(twin).not.toBeNull();
    expect(twin).toMatchObject({ status: "available", summaryCount: 2, version: 2 });
    // Real values (not just shapes): proves the snake_case profile keys are read correctly.
    expect(twin?.metrics?.summaryCount).toBe(2);
    expect(twin?.metrics?.trialCount).toBe(48);
    expect(typeof twin?.metrics?.accuracyPercent).toBe("number");
    expect(typeof twin?.metrics?.meanHitReactionTimeMs).toBe("number");
    expect(typeof twin?.accuracyDeltaPoints).toBe("number");
    expect(typeof twin?.meanHitReactionTimeDeltaMs).toBe("number");
    expect(twin?.baselineAt).toBeTruthy();
    expect(twin?.latestAt).toBeTruthy();
    expect(twin?.observationStart).toBeTruthy();
    expect(twin?.dataProvenance).toBeTruthy();
  });

  it("keeps an immutable, versioned Twin history", async () => {
    const snapshot = await controller.load();

    expect(snapshot.twinHistory.map((entry) => entry.version)).toEqual([2, 1]);
    expect(snapshot.twinHistory.map((entry) => entry.sourceCount)).toEqual([2, 1]);
    expect(snapshot.twinHistory[0].algorithmVersion).toBeTruthy();
  });

  it("lists the saved sessions with their activity and mode", async () => {
    const snapshot = await controller.load();

    expect(snapshot.sessions).toHaveLength(2);
    for (const session of snapshot.sessions) {
      expect(session.status).toBe("completed");
      expect(session.activities).toHaveLength(1);
      expect(session.activities[0]).toMatchObject({ activityCode: "cpt", mode: "scored", status: "completed" });
    }
    // Run IDs used by the UI are the activity assignment IDs, so history links resolve.
    const assignmentIds = snapshot.sessions.map((session) => session.activities[0].id).sort();
    expect(snapshot.serverRuns.map((run) => run.id).sort()).toEqual(assignmentIds);
  });

  it("creates a report from saved runs, and asking again for the same data returns the same report", async () => {
    const snapshot = await controller.load();
    const subjectId = snapshot.subjectId as string;

    const first = await controller.createReport(subjectId, snapshot.serverRuns.length);
    const again = await controller.createReport(subjectId, snapshot.serverRuns.length);

    expect(again.id).toBe(first.id);
    expect(first.summaryCount).toBe(2);
    expect(first.metrics?.accuracyPercent).toEqual(snapshot.twin?.metrics?.accuracyPercent);
    expect(first.limitations.join(" ")).toMatch(/not a diagnosis/i);

    const after = await controller.load();
    expect(after.reports.map((report) => report.id)).toEqual([first.id]);
  });

  it("another participant cannot read this participant's data", async () => {
    const other = createBackendClient({
      baseUrl: baseUrl as string,
      getIdToken: async () => "other-participant-token",
    });
    const ownSubjectId = (await controller.load()).subjectId as string;

    expect((await other.listSubjects()).items).toHaveLength(0);
    await expect(other.getProgress(ownSubjectId)).rejects.toMatchObject({ status: 404 });
  });

  it("withdrawal takes effect: further runs are refused, existing data stays readable", async () => {
    const snapshot = await controller.load();
    if (snapshot.consent.status !== "granted" || !snapshot.subjectId) {
      throw new Error("Expected granted consent before withdrawal.");
    }

    await controller.withdrawConsent(snapshot.subjectId, snapshot.consent.id);

    const after = await controller.load();
    expect(after.consent.status).toBe("none");
    expect(after.serverRuns).toHaveLength(2);
    // Existing server-side insights stay readable after withdrawal.
    expect(after.twin?.version).toBe(2);
    expect(after.reports).toHaveLength(1);
    await expect(
      controller.persistRun(buildRun(participantId, "run-after-withdrawal", (isTarget) => isTarget)),
    ).rejects.toBeInstanceOf(ConsentRequiredError);
  });

  it("consent can be granted again after withdrawal (fresh idempotency key)", async () => {
    const { consent } = await controller.grantConsent();
    expect(consent.status).toBe("granted");
    expect((await controller.load()).consent.status).toBe("granted");
  });

  // ---- Data rights (state here: consent granted, 2 saved runs, 1 report, Twin v2) ----

  it("exports everything stored, including trial events, as readable JSON", async () => {
    const subjectId = (await controller.load()).subjectId as string;

    const { filename, json } = await controller.exportData(subjectId);
    const bundle = JSON.parse(json) as ExportBundle;

    expect(filename).toMatch(/^attune-data-export-\d{8}\.json$/);
    expect(bundle.subject.id).toBe(subjectId);
    expect(bundle.sessions).toHaveLength(2);
    expect(bundle.sessions[0].activities[0].events).toHaveLength(24);
    expect(bundle.activitySummaries).toHaveLength(2);
    expect(bundle.digitalTwin.history).toHaveLength(2);
    expect(bundle.reports).toHaveLength(1);
    expect(bundle.consents.length).toBeGreaterThanOrEqual(2);
    expect(json).not.toContain("request_fingerprint");
  });

  it("shows an access log that separates the participant from other accounts", async () => {
    const subjectId = (await controller.load()).subjectId as string;
    const other = createBackendClient({
      baseUrl: baseUrl as string,
      getIdToken: async () => "other-participant-token",
    });
    await other.getProgress(subjectId).catch(() => undefined); // refused, but recorded

    const log = await controller.loadAccessLog(subjectId);

    const labels = log.filter((entry) => entry.byYou).map((entry) => entry.label);
    expect(labels).toContain("Research consent granted");
    expect(labels).toContain("Data export downloaded");
    const foreign = log.filter((entry) => !entry.byYou);
    expect(foreign.length).toBeGreaterThanOrEqual(1);
    expect(foreign.every((entry) => entry.attention)).toBe(true);
    expect(JSON.stringify(log)).not.toContain("other-participant-test-uid");
  });

  it("refuses export and erasure to anyone but the owner, leaving data intact", async () => {
    const subjectId = (await controller.load()).subjectId as string;
    const other = createBackendClient({
      baseUrl: baseUrl as string,
      getIdToken: async () => "other-participant-token",
    });

    await expect(other.exportSubjectData(subjectId)).rejects.toMatchObject({ status: 404 });
    await expect(other.eraseSubjectData(subjectId)).rejects.toMatchObject({ status: 404 });
    expect((await controller.load()).serverRuns).toHaveLength(2);
  });

  it("erases research data, withdraws consent, and keeps the audit trail", async () => {
    const before = await controller.load();
    const subjectId = before.subjectId as string;

    const result = await controller.eraseData(subjectId);

    expect(result.subjectId).toBe(subjectId);
    expect(result.withdrawnConsentCount).toBe(1);
    expect(result.deletedDocumentCounts.activitySummaries).toBe(2);
    expect(result.deletedDocumentCounts.digitalTwinHistory).toBe(2);
    expect(result.deletedDocumentCounts.reports).toBe(1);

    const after = await controller.load();
    expect(after.consent.status).toBe("none");
    expect(after.serverRuns).toEqual([]);
    expect(after.sessions).toEqual([]);
    expect(after.reports).toEqual([]);
    expect(after.twinHistory).toEqual([]);
    expect(after.twin).toMatchObject({ summaryCount: 0, status: "insufficient_data" });

    const log = await controller.loadAccessLog(subjectId);
    expect(log.map((entry) => entry.label)).toContain("Research data erased");

    const { json } = await controller.exportData(subjectId);
    const bundle = JSON.parse(json) as ExportBundle;
    expect(bundle.sessions).toEqual([]);
    expect(bundle.subject.data_erased_at).toBeTruthy();
  });

  it("after erasure nothing more is saved until consent is granted again, then a fresh start works", async () => {
    const run = buildRun(participantId, "run-after-erasure", (isTarget) => isTarget);

    await expect(controller.persistRun(run)).rejects.toBeInstanceOf(ConsentRequiredError);

    await controller.grantConsent();
    // The retry key from before erasure must not break or resurrect anything.
    const outcome = await controller.persistRun(
      buildRun(participantId, "run-contract-1", (isTarget) => isTarget),
    );
    expect(outcome.serverRunId).toBeTruthy();
    expect((await controller.load()).serverRuns).toHaveLength(1);
  });
});
