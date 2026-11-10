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
    expect(before).toEqual({ subjectId: null, consent: { status: "none" }, serverRuns: [] });
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
    await expect(
      controller.persistRun(buildRun(participantId, "run-after-withdrawal", (isTarget) => isTarget)),
    ).rejects.toBeInstanceOf(ConsentRequiredError);
  });

  it("consent can be granted again after withdrawal (fresh idempotency key)", async () => {
    const { consent } = await controller.grantConsent();
    expect(consent.status).toBe("granted");
    expect((await controller.load()).consent.status).toBe("granted");
  });
});
