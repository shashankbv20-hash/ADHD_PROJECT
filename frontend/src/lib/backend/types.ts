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

export interface BackendStopSignalEvent {
  trialIndex: number;
  trialId: string;
  stimulus: "L" | "R";
  isStop: boolean;
  stopSignalDelayMs: number | null;
  responded: boolean;
  responseDirection: "L" | "R" | null;
  reactionTimeMs: number | null;
}

export interface BackendStopSignalMetrics {
  trialCount: number;
  goTrialCount: number;
  stopTrialCount: number;
  goCorrectCount: number;
  goWrongDirectionCount: number;
  goOmissionCount: number;
  goAccuracyPercent: number | null;
  meanGoReactionTimeMs: number | null;
  goReactionTimeStddevMs: number | null;
  successfulStopCount: number;
  failedStopCount: number;
  stopSuccessRatePercent: number | null;
  meanStopSignalDelayMs: number | null;
  ssrtEstimateMs: number | null;
  ssrtReliable: boolean;
  dataProvenance: string;
  calculationVersion: string;
}

export type StroopColor = "R" | "G" | "B" | "Y";

export interface BackendStroopEvent {
  trialIndex: number;
  trialId: string;
  word: StroopColor;
  ink: StroopColor;
  responded: boolean;
  responseColor: StroopColor | null;
  reactionTimeMs: number | null;
}

export interface BackendStroopMetrics {
  trialCount: number;
  congruentTrialCount: number;
  incongruentTrialCount: number;
  correctCount: number;
  errorCount: number;
  omissionCount: number;
  accuracyPercent: number | null;
  congruentAccuracyPercent: number | null;
  incongruentAccuracyPercent: number | null;
  meanCongruentReactionTimeMs: number | null;
  meanIncongruentReactionTimeMs: number | null;
  interferenceMs: number | null;
  dataProvenance: string;
  calculationVersion: string;
}

export type TaskSwitchingRule = "colour" | "shape";
export type TaskSwitchingColour = "R" | "B";
export type TaskSwitchingShape = "O" | "Q";

export interface BackendTaskSwitchingEvent {
  trialIndex: number;
  trialId: string;
  rule: TaskSwitchingRule;
  colour: TaskSwitchingColour;
  shape: TaskSwitchingShape;
  responded: boolean;
  responseSide: "L" | "R" | null;
  reactionTimeMs: number | null;
}

export interface BackendTaskSwitchingMetrics {
  trialCount: number;
  switchTrialCount: number;
  repeatTrialCount: number;
  correctCount: number;
  errorCount: number;
  omissionCount: number;
  accuracyPercent: number | null;
  switchAccuracyPercent: number | null;
  repeatAccuracyPercent: number | null;
  meanSwitchReactionTimeMs: number | null;
  meanRepeatReactionTimeMs: number | null;
  switchCostMs: number | null;
  dataProvenance: string;
  calculationVersion: string;
}

export interface BackendVisualSearchEvent {
  trialIndex: number;
  trialId: string;
  setSize: 4 | 8 | 12;
  targetPresent: boolean;
  responded: boolean;
  response: "present" | "absent" | null;
  reactionTimeMs: number | null;
}

export interface BackendVisualSearchMetrics {
  trialCount: number;
  targetPresentCount: number;
  targetAbsentCount: number;
  correctCount: number;
  errorCount: number;
  omissionCount: number;
  accuracyPercent: number | null;
  presentAccuracyPercent: number | null;
  absentAccuracyPercent: number | null;
  meanReactionTimeMs: number | null;
  reactionTimeBySetSize: { setSize: number; meanReactionTimeMs: number | null }[];
  searchSlopeMsPerItem: number | null;
  dataProvenance: string;
  calculationVersion: string;
}

export interface BackendPlanningPuzzleEvent {
  trialIndex: number;
  trialId: string;
  discCount: 3 | 4;
  /** Moves like "AB" = top disc from peg A to peg B. */
  moves: string[];
  illegalAttempts: number;
  firstMoveLatencyMs: number | null;
  totalTimeMs: number;
}

export interface BackendPlanningPuzzleMetrics {
  puzzleCount: number;
  solvedCount: number;
  solvedPercent: number | null;
  optimalCount: number;
  totalMoves: number;
  meanExtraMoves: number | null;
  illegalAttempts: number;
  meanPlanningTimeMs: number | null;
  meanSolutionTimeMs: number | null;
  dataProvenance: string;
  calculationVersion: string;
}

export interface BackendVisualSequenceEvent {
  trialIndex: number;
  trialId: string;
  sequenceLength: number;
  /** Cells tapped, 0-8 (left to right, top to bottom). */
  response: number[];
  firstResponseLatencyMs: number | null;
  totalResponseTimeMs: number;
}

export interface BackendVisualSequenceMetrics {
  trialCount: number;
  correctCount: number;
  accuracyPercent: number | null;
  longestCorrectSpan: number | null;
  correctPositionPercent: number | null;
  noResponseCount: number;
  meanFirstResponseMs: number | null;
  dataProvenance: string;
  calculationVersion: string;
}

export interface BackendTimePerceptionEvent {
  trialIndex: number;
  trialId: string;
  targetMs: number;
  /** Null when the child gave no answer. */
  reproducedMs: number | null;
}

export interface BackendTimePerceptionMetrics {
  trialCount: number;
  responseCount: number;
  noResponseCount: number;
  meanAbsoluteErrorMs: number | null;
  meanSignedErrorMs: number | null;
  meanRatio: number | null;
  ratioVariability: number | null;
  withinToleranceCount: number;
  withinTolerancePercent: number;
  dataProvenance: string;
  calculationVersion: string;
}

export interface BackendObjectTrackingEvent {
  trialIndex: number;
  trialId: string;
  objectCount: 8;
  targetCount: 2 | 3 | 4;
  /** Circle numbers picked, 0-7. */
  selected: number[];
  responseTimeMs: number | null;
}

export interface BackendObjectTrackingMetrics {
  trialCount: number;
  perfectCount: number;
  perfectPercent: number | null;
  targetsFoundPercent: number | null;
  wrongPickCount: number;
  highestPerfectLoad: number | null;
  byLoad: { targetCount: number; trialCount: number; targetsFoundPercent: number | null }[];
  meanResponseTimeMs: number | null;
  dataProvenance: string;
  calculationVersion: string;
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
  metrics:
    | BackendCptMetrics
    | BackendStopSignalMetrics
    | BackendStroopMetrics
    | BackendTaskSwitchingMetrics
    | BackendVisualSearchMetrics
    | BackendPlanningPuzzleMetrics
    | BackendVisualSequenceMetrics
    | BackendTimePerceptionMetrics
    | BackendObjectTrackingMetrics;
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

export interface BackendAuditEvent {
  id: string;
  action: string;
  resourceType: string;
  createdAt: string | null;
  /** True when the participant's own account performed the action. */
  actorIsYou: boolean;
  details: Record<string, string | number | boolean | null>;
}

export interface DataErasureResult {
  subjectId: string;
  erasedAt: string;
  withdrawnConsentCount: number;
  deletedDocumentCounts: Record<string, number>;
}

export interface BackendCaregiverRelationship {
  id: string;
  caregiverUserId: string;
  subjectId: string;
  status: "active" | "revoked";
  createdAt: string;
  revokedAt: string | null;
}

/** A subject shared with the signed-in caregiver. The owner's identity is not included. */
export interface BackendSharedSubject {
  subjectId: string;
  displayLabel: string | null;
  relationshipId: string;
  sharedSince: string | null;
}

export interface BackendCapabilities {
  apiVersion: string;
  firestore: { configured: boolean };
  eeg: { available: boolean; reason?: string };
  webcam: { available: boolean; reason?: string };
  aiBuddy: { available: boolean; reason?: string };
}
