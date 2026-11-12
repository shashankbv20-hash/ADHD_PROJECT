import {
  collection,
  doc,
  getDocFromServer as getDoc,
  getDocsFromServer as getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { buildDigitalTwinProfile } from "@/features/digital-twin/digital-twin-profile-data";
import { FirebaseOperationError, normalizeFirebaseError } from "@/lib/firebase/firebase-errors";
import type {
  FirebaseAccountSnapshot,
  FirebaseApplicationSession,
  FirebaseCptSummaryDocument,
  FirebaseDigitalTwinSnapshot,
  FirebaseSavedReportSummary,
  FirebaseUserProfile,
} from "@/lib/firebase/firebase-types";
import type { CptMetrics, CptRunSummary } from "@/types";

const SCHEMA_VERSION = 1 as const;
const DATA_PROVENANCE = "frontend-cpt-demo-v1" as const;
const MAX_STORED_RUNS = 12;
const MAX_STORED_REPORTS = 20;

function profileRef(db: Firestore, uid: string) {
  return doc(db, "users", uid);
}

function userCollection(db: Firestore, uid: string, collectionName: string) {
  return collection(db, "users", uid, collectionName);
}

function asIsoString(value: unknown): string | null {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value === "string" && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }

  return null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function readMetrics(data: Record<string, unknown>): CptMetrics | null {
  const countKeys = [
    "trialCount",
    "targetCount",
    "nonTargetCount",
    "responseCount",
    "hitCount",
    "missCount",
    "falseAlarmCount",
    "correctRejectionCount",
    "validReactionTimeCount",
  ] as const;

  if (!countKeys.every((key) => isNonNegativeInteger(data[key])) ||
      !isNonNegativeInteger(data.hitReactionTimeTotalMs) ||
      ![data.accuracyPercent, data.meanHitReactionTimeMs].every(
        (value) => value === null || (typeof value === "number" && Number.isFinite(value)),
      )) {
    return null;
  }

  const accuracyPercent = asNullableNumber(data.accuracyPercent);
  const meanHitReactionTimeMs = asNullableNumber(data.meanHitReactionTimeMs);

  if (
    (accuracyPercent !== null && (accuracyPercent < 0 || accuracyPercent > 100)) ||
    (meanHitReactionTimeMs !== null && (meanHitReactionTimeMs < 0 || meanHitReactionTimeMs > 2200)) ||
    data.hitReactionTimeTotalMs > (data.validReactionTimeCount as number) * 2200
  ) {
    return null;
  }

  return {
    trialCount: data.trialCount as number,
    targetCount: data.targetCount as number,
    nonTargetCount: data.nonTargetCount as number,
    responseCount: data.responseCount as number,
    hitCount: data.hitCount as number,
    missCount: data.missCount as number,
    falseAlarmCount: data.falseAlarmCount as number,
    correctRejectionCount: data.correctRejectionCount as number,
    accuracyPercent,
    meanHitReactionTimeMs,
    validReactionTimeCount: data.validReactionTimeCount as number,
    hitReactionTimeTotalMs: data.hitReactionTimeTotalMs,
  };
}

function readUserProfile(uid: string, rawData: Record<string, unknown>): FirebaseUserProfile {
  const displayName = typeof rawData.displayName === "string"
    ? rawData.displayName.trim()
    : "";

  if (
    rawData.uid !== uid ||
    rawData.role !== "participant" ||
    typeof rawData.cloudSyncEnabled !== "boolean" ||
    !displayName ||
    displayName.length > 120
  ) {
    throw new FirebaseOperationError(
      "invalid-data",
      "The participant profile is incomplete or uses unsupported fields. Contact the project administrator before changing this record.",
    );
  }

  return {
    uid,
    displayName,
    role: "participant",
    cloudSyncEnabled: rawData.cloudSyncEnabled,
    createdAt: asIsoString(rawData.createdAt),
    updatedAt: asIsoString(rawData.updatedAt),
  };
}

export async function ensureFirebaseUserProfile(
  db: Firestore,
  user: User,
  requestedDisplayName?: string,
): Promise<FirebaseUserProfile> {
  const ref = profileRef(db, user.uid);
  const proposedName = (requestedDisplayName ?? user.displayName ?? user.email?.split("@")[0] ?? "Participant").trim().slice(0, 120);

  if (!proposedName) {
    throw new FirebaseOperationError(
      "profile-initialization",
      "A participant display name is required to initialize the account profile.",
    );
  }

  try {
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(ref);

      if (!existing.exists()) {
        transaction.set(ref, {
          uid: user.uid,
          displayName: proposedName,
          role: "participant",
          cloudSyncEnabled: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      }

      const current = readUserProfile(user.uid, existing.data());

      if (requestedDisplayName && current.displayName !== proposedName) {
        transaction.update(ref, {
          displayName: proposedName,
          updatedAt: serverTimestamp(),
        });
      }
    });

    const profileSnapshot = await getDoc(ref);

    if (!profileSnapshot.exists()) {
      throw new FirebaseOperationError(
        "profile-initialization",
        "The participant profile was not available after initialization. Retry profile setup.",
      );
    }

    return readUserProfile(user.uid, profileSnapshot.data());
  } catch (error) {
    throw normalizeFirebaseError(error, "profile-initialization");
  }
}

function toCptRunSummary(
  uid: string,
  documentId: string,
  data: Record<string, unknown>,
): CptRunSummary | null {
  const metrics = readMetrics(data);
  const completedAt = asIsoString(data.completedAt);

  if (
    !metrics ||
    !completedAt ||
    data.activityId !== "cpt" ||
    data.mode !== "scored" ||
    data.schemaVersion !== SCHEMA_VERSION ||
    data.dataProvenance !== DATA_PROVENANCE
  ) {
    return null;
  }

  return {
    id: documentId,
    participantId: uid,
    activityId: "cpt",
    mode: "scored",
    completedAt,
    events: [],
    isDemo: true,
    ...metrics,
  };
}

function toApplicationSession(
  documentId: string,
  data: Record<string, unknown>,
): FirebaseApplicationSession | null {
  const createdAt = asIsoString(data.createdAt);
  const updatedAt = asIsoString(data.updatedAt);

  if (
    data.sessionId !== documentId ||
    data.sessionType !== "cpt" ||
    data.status !== "complete" ||
    data.activityId !== "cpt" ||
    !isNonNegativeInteger(data.trialCount) ||
    data.schemaVersion !== SCHEMA_VERSION ||
    data.dataProvenance !== DATA_PROVENANCE ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    sessionId: documentId,
    sessionType: "cpt",
    status: "complete",
    activityId: "cpt",
    trialCount: data.trialCount,
    createdAt,
    updatedAt,
    schemaVersion: SCHEMA_VERSION,
    dataProvenance: DATA_PROVENANCE,
  };
}

function toSavedReport(
  documentId: string,
  data: Record<string, unknown>,
): FirebaseSavedReportSummary | null {
  const metrics = readMetrics(data);
  const createdAt = asIsoString(data.createdAt);

  if (
    !metrics ||
    !createdAt ||
    data.reportId !== documentId ||
    typeof data.runId !== "string" ||
    data.reportType !== "cpt-summary" ||
    data.schemaVersion !== SCHEMA_VERSION ||
    data.dataProvenance !== DATA_PROVENANCE
  ) {
    return null;
  }

  return {
    reportId: documentId,
    runId: data.runId,
    reportType: "cpt-summary",
    createdAt,
    schemaVersion: SCHEMA_VERSION,
    dataProvenance: DATA_PROVENANCE,
    ...metrics,
  };
}

function toDigitalTwinSnapshot(
  data: Record<string, unknown> | undefined,
): FirebaseDigitalTwinSnapshot | null {
  if (!data) {
    return null;
  }

  const metrics = readMetrics(data);
  const updatedAt = asIsoString(data.updatedAt);
  const sourceRunIds = Array.isArray(data.sourceRunIds)
    ? data.sourceRunIds.every((id) => typeof id === "string")
      ? data.sourceRunIds
      : null
    : null;

  if (
    !metrics ||
    !updatedAt ||
    !sourceRunIds ||
    !isNonNegativeInteger(data.sourceRunCount) ||
    data.sourceRunCount !== sourceRunIds.length ||
    !isNonNegativeInteger(data.completeTrialLogCount) ||
    typeof data.consistentTrialCount !== "boolean" ||
    data.schemaVersion !== SCHEMA_VERSION ||
    data.dataProvenance !== DATA_PROVENANCE
  ) {
    return null;
  }

  return {
    ...metrics,
    sourceRunIds,
    sourceRunCount: data.sourceRunCount,
    baselineRunId: typeof data.baselineRunId === "string" ? data.baselineRunId : null,
    latestRunId: typeof data.latestRunId === "string" ? data.latestRunId : null,
    accuracyDelta: asNullableNumber(data.accuracyDelta),
    reactionTimeDelta: asNullableNumber(data.reactionTimeDelta),
    completeTrialLogCount: data.completeTrialLogCount,
    consistentTrialCount: data.consistentTrialCount,
    observationStart: asIsoString(data.observationStart),
    observationEnd: asIsoString(data.observationEnd),
    updatedAt,
    schemaVersion: SCHEMA_VERSION,
    dataProvenance: DATA_PROVENANCE,
  };
}

export async function loadFirebaseAccountSnapshot(
  db: Firestore,
  uid: string,
): Promise<FirebaseAccountSnapshot> {
  try {
    const profileSnapshot = await getDoc(profileRef(db, uid));

    if (!profileSnapshot.exists()) {
      throw new FirebaseOperationError(
        "profile-initialization",
        "The participant profile is missing. Retry profile setup.",
      );
    }

    const [activitySnapshot, sessionSnapshot, reportSnapshot, twinSnapshot] =
      await Promise.all([
        getDocs(
          query(
            userCollection(db, uid, "activityRuns"),
            orderBy("completedAt", "desc"),
            limit(MAX_STORED_RUNS),
          ),
        ),
        getDocs(
          query(
            userCollection(db, uid, "appSessions"),
            orderBy("updatedAt", "desc"),
            limit(30),
          ),
        ),
        getDocs(
          query(
            userCollection(db, uid, "reports"),
            orderBy("createdAt", "desc"),
            limit(MAX_STORED_REPORTS),
          ),
        ),
        getDoc(doc(db, "users", uid, "digitalTwin", "current")),
      ]);

    const requireValid = <T,>(value: T | null): T => {
      if (value === null) throw new FirebaseOperationError("invalid-data", "A saved account record does not match the supported schema. No demo data was substituted.");
      return value;
    };

    return {
      profile: readUserProfile(uid, profileSnapshot.data()),
      activityRuns: activitySnapshot.docs
        .map((entry) => requireValid(toCptRunSummary(uid, entry.id, entry.data()))),
      appSessions: sessionSnapshot.docs
        .map((entry) => requireValid(toApplicationSession(entry.id, entry.data()))),
      reports: reportSnapshot.docs
        .map((entry) => requireValid(toSavedReport(entry.id, entry.data()))),
      digitalTwin: twinSnapshot.exists()
        ? requireValid(toDigitalTwinSnapshot(twinSnapshot.data())) : null,
    };
  } catch (error) {
    throw normalizeFirebaseError(error);
  }
}

export async function updateFirebaseCloudSyncPreference(
  db: Firestore,
  uid: string,
  enabled: boolean,
): Promise<FirebaseUserProfile> {
  try {
    const ref = profileRef(db, uid);
    await updateDoc(ref, {
      cloudSyncEnabled: enabled,
      updatedAt: serverTimestamp(),
    });
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      throw new FirebaseOperationError(
        "profile-initialization",
        "The participant profile was not available after updating the sync preference.",
      );
    }

    return readUserProfile(uid, snapshot.data());
  } catch (error) {
    throw normalizeFirebaseError(error);
  }
}

export async function updateFirebaseDisplayName(
  db: Firestore,
  uid: string,
  displayName: string,
): Promise<FirebaseUserProfile> {
  try {
    const ref = profileRef(db, uid);
    await updateDoc(ref, { displayName, updatedAt: serverTimestamp() });
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      throw new FirebaseOperationError(
        "profile-initialization",
        "The participant profile was not available after updating the name.",
      );
    }

    return readUserProfile(uid, snapshot.data());
  } catch (error) {
    throw normalizeFirebaseError(error);
  }
}

function toFirestoreCptSummary(
  run: CptRunSummary,
): Omit<FirebaseCptSummaryDocument, "completedAt"> & {
  completedAt: Timestamp;
} {
  const completedDate = new Date(run.completedAt);

  if (!Number.isFinite(completedDate.getTime())) {
    throw new FirebaseOperationError(
      "invalid-data",
      "This activity summary has an invalid completion time and was not saved.",
    );
  }

  return {
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
    hitReactionTimeTotalMs: run.hitReactionTimeTotalMs ?? 0,
    activityId: "cpt",
    mode: "scored",
    completedAt: Timestamp.fromDate(completedDate),
    schemaVersion: SCHEMA_VERSION,
    dataProvenance: DATA_PROVENANCE,
  };
}

function toFirestoreDigitalTwin(
  runs: readonly CptRunSummary[],
): Omit<
  FirebaseDigitalTwinSnapshot,
  "updatedAt" | "observationStart" | "observationEnd"
> & {
  updatedAt: ReturnType<typeof serverTimestamp>;
  observationStart: Timestamp | null;
  observationEnd: Timestamp | null;
} {
  const profile = buildDigitalTwinProfile(runs);

  return {
    sourceRunIds: profile.scoredRuns.map((run) => run.id),
    sourceRunCount: profile.scoredRuns.length,
    trialCount: profile.aggregate.trialCount,
    targetCount: profile.aggregate.targetCount,
    nonTargetCount: profile.aggregate.nonTargetCount,
    responseCount: profile.aggregate.responseCount,
    hitCount: profile.aggregate.hitCount,
    missCount: profile.aggregate.missCount,
    falseAlarmCount: profile.aggregate.falseAlarmCount,
    correctRejectionCount: profile.aggregate.correctRejectionCount,
    accuracyPercent: profile.aggregate.accuracyPercent,
    meanHitReactionTimeMs: profile.aggregate.meanHitReactionTimeMs,
    validReactionTimeCount: profile.aggregate.validReactionTimeCount,
    hitReactionTimeTotalMs: profile.aggregate.hitReactionTimeTotalMs ?? 0,
    baselineRunId: profile.baselineRun?.id ?? null,
    latestRunId: profile.latestRun?.id ?? null,
    accuracyDelta: profile.baselineComparison?.accuracyDelta ?? null,
    reactionTimeDelta: profile.baselineComparison?.reactionTimeDelta ?? null,
    completeTrialLogCount: profile.completeTrialLogCount,
    consistentTrialCount: profile.consistentTrialCount,
    observationStart: profile.observationWindow?.start
      ? Timestamp.fromDate(new Date(profile.observationWindow.start))
      : null,
    observationEnd: profile.observationWindow?.end
      ? Timestamp.fromDate(new Date(profile.observationWindow.end))
      : null,
    updatedAt: serverTimestamp(),
    schemaVersion: SCHEMA_VERSION,
    dataProvenance: DATA_PROVENANCE,
  };
}

export async function saveFirebaseCptRun(
  db: Firestore,
  uid: string,
  run: CptRunSummary,
): Promise<FirebaseDigitalTwinSnapshot> {
  try {
    if (run.mode !== "scored") {
      throw new FirebaseOperationError(
        "invalid-data",
        "Only scored CPT summaries can be synchronized.",
      );
    }

    const activityRunRef = doc(db, "users", uid, "activityRuns", run.id);
    const appSessionRef = doc(db, "users", uid, "appSessions", run.id);
    const runData = toFirestoreCptSummary(run);

    await runTransaction(db, async (transaction) => {
      const [existingRun, existingSession] = await Promise.all([
        transaction.get(activityRunRef),
        transaction.get(appSessionRef),
      ]);

      if (!existingRun.exists()) {
        transaction.set(activityRunRef, runData);
      }

      if (!existingSession.exists()) {
        transaction.set(appSessionRef, {
          sessionId: run.id,
          sessionType: "cpt",
          status: "complete",
          activityId: "cpt",
          trialCount: run.trialCount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          schemaVersion: SCHEMA_VERSION,
          dataProvenance: DATA_PROVENANCE,
        });
      }
    });

    const persistedAccount = await loadFirebaseAccountSnapshot(db, uid);
    const twinRef = doc(db, "users", uid, "digitalTwin", "current");
    try {
      await setDoc(
        twinRef,
        toFirestoreDigitalTwin(persistedAccount.activityRuns),
        { merge: true },
      );
    } catch {
      throw new FirebaseOperationError(
        "partial-save",
        "The CPT summary and session metadata were saved, but the Digital Twin snapshot could not be updated. Refresh account data and retry with another scored run.",
      );
    }
    const twinSnapshot = await getDoc(twinRef);
    const twin = twinSnapshot.exists()
      ? toDigitalTwinSnapshot(twinSnapshot.data())
      : null;

    if (!twin) {
      throw new FirebaseOperationError(
        "partial-save",
        "The CPT summary and session metadata were saved, but the Digital Twin snapshot could not be verified.",
      );
    }

    return twin;
  } catch (error) {
    throw normalizeFirebaseError(error);
  }
}

export async function saveFirebaseReportSummary(
  db: Firestore,
  uid: string,
  run: CptRunSummary,
): Promise<FirebaseSavedReportSummary> {
  try {
    const reportRef = doc(db, "users", uid, "reports", run.id);
    const reportData = {
      reportId: run.id,
      runId: run.id,
      reportType: "cpt-summary",
      createdAt: serverTimestamp(),
      schemaVersion: SCHEMA_VERSION,
      dataProvenance: DATA_PROVENANCE,
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
      hitReactionTimeTotalMs: run.hitReactionTimeTotalMs ?? 0,
    };

    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(reportRef);

      if (!existing.exists()) {
        transaction.set(reportRef, reportData);
      }
    });

    const saved = await getDoc(reportRef);
    const report = saved.exists() ? toSavedReport(saved.id, saved.data()) : null;

    if (!report) {
      throw new FirebaseOperationError(
        "invalid-data",
        "The report summary could not be verified after saving.",
      );
    }

    return report;
  } catch (error) {
    throw normalizeFirebaseError(error);
  }
}
