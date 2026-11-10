/**
 * Wire types for the FastAPI backend (`/api/v1`), mirroring
 * `backend/app/schemas.py` (camelCase aliases). UUID fields are strings;
 * user identifiers are Firebase UID strings; timestamps are ISO-8601 strings.
 *
 * These are the *real* contract and supersede the logical proposals in
 * `src/types/api.ts`, which are kept only for the unconnected remote adapters.
 */

export type BackendRole = "participant" | "caregiver" | "clinician" | "researcher";

export interface BackendUser {
  id: string;
  firebaseUid: string;
  role: BackendRole;
  displayName: string | null;
  createdAt: string;
}

export interface BackendSubject {
  id: string;
  displayLabel: string | null;
  ownerUserId: string;
  createdAt: string;
  isActive: boolean;
}

export type ConsentScope = "research" | "eeg_processing" | "webcam_analysis";

export interface BackendConsent {
  id: string;
  subjectId: string;
  actorUserId: string;
  scope: ConsentScope;
  version: string;
  idempotencyKey: string;
  status: "granted" | "withdrawn" | "denied" | "superseded";
  grantedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
}

export interface ConsentCreateRequest {
  scope: ConsentScope;
  version: string;
  /** 8–128 chars; the same key always maps to the same consent record. */
  idempotencyKey: string;
}

export type ActivityMode = "practice" | "scored";

export interface SessionCreateRequest {
  subjectId: string;
  activities: { activityCode: string; mode: ActivityMode }[];
  /** 8–128 chars; retries with the same key return the same session. */
  idempotencyKey: string;
}

export interface BackendSessionActivity {
  id: string;
  activityCode: string;
  position: number;
  status: "assigned" | "active" | "paused" | "completed" | "skipped";
  mode: ActivityMode;
  startedAt: string | null;
  completedAt: string | null;
}

export interface BackendSession {
  id: string;
  subjectId: string;
  status: "created" | "active" | "paused" | "completed" | "cancelled";
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  activities: BackendSessionActivity[];
}

export interface BackendCptEvent {
  trialIndex: number;
  trialId: string;
  stimulus: string;
  isTarget: boolean;
  responded: boolean;
  reactionTimeMs: number | null;
  outcome?: "hit" | "miss" | "false-alarm" | "correct-rejection" | null;
}

export interface EventBatchResponse {
  acceptedCount: number;
  duplicateCount: number;
  totalEventCount: number;
}

export interface BackendCptMetrics {
  trialCount: number;
  targetCount: number;
  nonTargetCount: number;
  responseCount: number;
  hitCount: number;
  missCount: number;
  falseAlarmCount: number;
  correctRejectionCount: number;
  accuracyPercent: number | null;
  meanHitReactionTimeMs: number | null;
  hitReactionTimeStddevMs: number | null;
  hitReactionTimeTotalMs: number;
  validReactionTimeCount: number;
  omissionErrorCount: number;
  commissionErrorCount: number;
  blockMetrics: {
    block: number;
    trialCount: number;
    accuracyPercent: number;
    meanHitReactionTimeMs: number | null;
  }[];
  dataProvenance: string;
  calculationVersion: string;
}

export interface BackendActivitySummary {
  id: string;
  sessionActivityId: string;
  subjectId: string;
  activityCode: string;
  metrics: BackendCptMetrics;
  dataProvenance: string;
  calculationVersion: string;
  createdAt: string;
}

export interface BackendActivitySummaryPage {
  items: BackendActivitySummary[];
  nextCursor: string | null;
}

export interface BackendProgress {
  subjectId: string;
  summaryCount: number;
  aggregateMetrics: Record<string, number | string | null> | null;
  observationStart: string | null;
  observationEnd: string | null;
  dataProvenance: string;
}

export interface BackendDigitalTwin {
  subjectId: string;
  version: number;
  status: "available" | "insufficient_data";
  profile: Record<string, unknown>;
  qualityFlags: string[];
  updatedAt: string | null;
}

export interface BackendSessionPage {
  items: BackendSession[];
  nextCursor: string | null;
}

export interface BackendDigitalTwinHistoryItem {
  id: string;
  subjectId: string;
  version: number;
  sourceSummaryIds: string[];
  snapshot: Record<string, unknown>;
  qualityFlags: string[];
  algorithmVersion: string;
  createdAt: string;
}

export interface BackendReport {
  id: string;
  subjectId: string;
  sessionId: string | null;
  reportType: string;
  templateVersion: string;
  content: Record<string, unknown>;
  createdAt: string;
}

export interface ReportCreateRequest {
  sessionId?: string;
  /** 8–128 chars; the same key returns the same report. */
  idempotencyKey: string;
}

export interface BackendCapabilities {
  apiVersion: string;
  firestore: { configured: boolean };
  eeg: { available: boolean; reason?: string };
  webcam: { available: boolean; reason?: string };
  aiBuddy: { available: boolean; reason?: string };
}
