import type {
  CptMetrics,
  CptRunSummary,
} from "@/types";

export type FirebaseParticipantRole = "participant";

export interface FirebaseUserProfile {
  uid: string;
  displayName: string;
  role: FirebaseParticipantRole;
  cloudSyncEnabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface FirebaseCptSummaryDocument extends CptMetrics {
  activityId: "cpt";
  mode: "scored";
  completedAt: string;
  schemaVersion: 1;
  dataProvenance: "frontend-cpt-demo-v1";
}

export interface FirebaseApplicationSession {
  sessionId: string;
  sessionType: "cpt";
  status: "complete";
  activityId: "cpt";
  trialCount: number;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
  dataProvenance: "frontend-cpt-demo-v1";
}

export interface FirebaseSavedReportSummary extends CptMetrics {
  reportId: string;
  runId: string;
  reportType: "cpt-summary";
  createdAt: string;
  schemaVersion: 1;
  dataProvenance: "frontend-cpt-demo-v1";
}

export interface FirebaseDigitalTwinSnapshot extends CptMetrics {
  sourceRunIds: string[];
  sourceRunCount: number;
  baselineRunId: string | null;
  latestRunId: string | null;
  accuracyDelta: number | null;
  reactionTimeDelta: number | null;
  completeTrialLogCount: number;
  consistentTrialCount: boolean;
  observationStart: string | null;
  observationEnd: string | null;
  updatedAt: string;
  schemaVersion: 1;
  dataProvenance: "frontend-cpt-demo-v1";
}

export interface FirebaseAccountSnapshot {
  profile: FirebaseUserProfile;
  activityRuns: CptRunSummary[];
  appSessions: FirebaseApplicationSession[];
  reports: FirebaseSavedReportSummary[];
  digitalTwin: FirebaseDigitalTwinSnapshot | null;
}
