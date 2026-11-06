export type WorkspaceRole = "participant" | "clinician" | "researcher";

export interface DemoMeta {
  isDemo: true;
  label: string;
  note: string;
  snapshotDate: string;
}

export type SessionStatus =
  | "analyzed"
  | "processing"
  | "needs-review"
  | "failed";

export interface EegSession {
  id: string;
  recordedAt: string;
  protocol: string;
  durationMinutes: number;
  signalQuality: number;
  focusIndex: number | null;
  status: SessionStatus;
  isDemo: true;
}

export interface FocusTrendPoint {
  session: string;
  focusIndex: number;
}

export interface BandPowerPoint {
  band: "Delta" | "Theta" | "Alpha" | "Beta";
  relativePower: number;
}

export interface DigitalTwinTrait {
  id: string;
  label: string;
  value: number;
  max: number;
  description: string;
}

export interface ActivitySummary {
  id: string;
  title: string;
  completedAt: string;
  durationMinutes: number;
  accuracy: number | null;
  status: "completed" | "in-progress" | "not-started";
}

export interface ParticipantProfile {
  id: string;
  displayName: string;
  initials: string;
  ageBand: string;
  memberSince: string;
  researchCode: string;
}

export type DashboardStatId =
  | "sessions"
  | "signal-quality"
  | "focus-index"
  | "activities";

export interface DashboardStat {
  id: DashboardStatId;
  label: string;
  value: string;
  unit?: string;
  delta: string;
  deltaDirection: "up" | "down" | "flat";
  description: string;
}

export interface ParticipantDashboard {
  meta: DemoMeta;
  participant: ParticipantProfile;
  stats: DashboardStat[];
  focusTrend: FocusTrendPoint[];
  bandPower: BandPowerPoint[];
  recentSessions: EegSession[];
  twinTraits: DigitalTwinTrait[];
  activities: ActivitySummary[];
  weeklyConsistency: Array<{ day: string; minutes: number }>;
}

export type ClinicianRosterStatus = "on-track" | "review-needed" | "new";

export interface ClinicianParticipant {
  id: string;
  displayName: string;
  initials: string;
  researchCode: string;
  ageBand: string;
  lastSessionAt: string;
  sessionCount: number;
  signalQuality: number;
  focusTrend: "up" | "down" | "flat";
  status: ClinicianRosterStatus;
}

export interface ReviewQueueItem {
  id: string;
  participantName: string;
  researchCode: string;
  sessionId: string;
  submittedAt: string;
  reason: string;
  priority: "routine" | "priority";
}

export interface ClinicianOverview {
  meta: DemoMeta;
  roster: ClinicianParticipant[];
  reviewQueue: ReviewQueueItem[];
}

export type ModelStatus = "evaluated" | "in-review" | "planned" | "unavailable";

export interface ModelEvaluation {
  id: string;
  name: string;
  architecture: string;
  version: string;
  dataset: string;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  auc: number | null;
  status: ModelStatus;
  trainingStatus: string;
  evaluationStatus: string;
  limitations: string[];
  provenance: string;
}

export interface FeatureImportancePoint {
  feature: string;
  importance: number;
}

export type ResearchExperimentStatus =
  | "planned"
  | "in-progress"
  | "completed"
  | "unavailable";

export type ResearchExecutionStatus = "not-run" | "demo-only";

export interface ResearchExperiment {
  id: string;
  name: string;
  researchQuestion: string;
  methodology: string;
  status: ResearchExperimentStatus;
  updatedAt: string;
  datasetIds: string[];
  modelIds: string[];
  executionStatus: ResearchExecutionStatus;
  resultsAvailable: boolean;
  limitations: string[];
  reproducibility: string[];
}

export type ResearchDatasetAvailability =
  | "demo-fixture"
  | "session-only"
  | "demo-metadata"
  | "unavailable";

export interface ResearchDataset {
  id: string;
  name: string;
  modality: string;
  description: string;
  intendedUse: string;
  availability: ResearchDatasetAvailability;
  participantCount: number | null;
  sampleCount: number | null;
  formats: string[];
  source: string;
  provenance: string;
  limitations: string[];
  localFileVerified: boolean;
}

export interface ResearchExplainability {
  status: "illustrative" | "unavailable";
  method: string;
  modelId: string | null;
  dataset: string;
  availableOutputs: string[];
  unavailableOutputs: string[];
  limitations: string[];
  provenance: string;
}

export interface ProvenanceRecord {
  label: string;
  value: string;
  detail: string;
}

export interface ResearchOverview {
  meta: DemoMeta;
  models: ModelEvaluation[];
  datasets: ResearchDataset[];
  experiments: ResearchExperiment[];
  featureImportance: FeatureImportancePoint[];
  explainability: ResearchExplainability;
  provenance: ProvenanceRecord[];
}

export type UploadSessionStatus = "processing" | "complete" | "failed";

export type ProcessingStageId =
  | "received"
  | "validated"
  | "preprocessing"
  | "features"
  | "review";

export interface DemoUploadSession {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  fileExtension: string;
  protocol: string;
  uploadedAt: string;
  consentAcceptedAt: string;
  status: UploadSessionStatus;
  completedStageIds: ProcessingStageId[];
  isDemo: true;
}

export type CognitiveActivityId =
  | "cpt"
  | "go-no-go"
  | "selective-attention"
  | "n-back"
  | "visual-sequence"
  | "focus-arena";

export type CognitiveActivityAvailability = "available" | "planned";

export interface CognitiveActivityDefinition {
  id: CognitiveActivityId;
  title: string;
  description: string;
  estimatedDurationMinutes?: number;
  availability: CognitiveActivityAvailability;
  href?: string;
}

export type CptTrialOutcome =
  | "hit"
  | "miss"
  | "false-alarm"
  | "correct-rejection";

export interface CptTrialDefinition {
  id: string;
  stimulus: string;
  isTarget: boolean;
}

export interface CptTrialEvent {
  trialIndex: number;
  trialId: string;
  stimulus: string;
  isTarget: boolean;
  responded: boolean;
  reactionTimeMs: number | null;
  outcome: CptTrialOutcome;
}

export interface CptMetrics {
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
  validReactionTimeCount: number;
  /** Aggregate only, not a response timeline; preserves exact multi-run means. */
  hitReactionTimeTotalMs?: number;
}

export interface CptRunSummary extends CptMetrics {
  id: string;
  participantId: string;
  activityId: "cpt";
  mode: "practice" | "scored";
  completedAt: string;
  events: CptTrialEvent[];
  isDemo: true;
}
