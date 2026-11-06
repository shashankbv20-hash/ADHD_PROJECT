import type {
  ActivitySummary,
  BandPowerPoint,
  ClinicianOverview,
  ClinicianParticipant,
  CognitiveActivityDefinition,
  CptMetrics,
  CptRunSummary,
  CptTrialEvent,
  DigitalTwinTrait,
  EegSession,
  FeatureImportancePoint,
  FocusTrendPoint,
  ModelEvaluation,
  ParticipantProfile,
  ResearchDataset,
  ResearchExperiment,
  ResearchExplainability,
} from "@/types";

/**
 * Logical frontend contract proposals derived from current UI needs.
 * Endpoint paths, HTTP methods, transport envelopes, and backend field mappings
 * remain unconfirmed until a backend specification is supplied.
 */
export interface ApiOperation<Request, Response> {
  request: Request;
  response: Response;
}

export interface ParticipantSummaryResponse {
  profile: ParticipantProfile;
  recentSessions: SessionSummaryResponse[];
  activitySummaries?: ActivitySummary[];
}

export type SessionSummaryResponse = Pick<EegSession, "id" | "status"> &
  Partial<
    Pick<
      EegSession,
      "recordedAt" | "protocol" | "durationMinutes" | "signalQuality" | "focusIndex"
    >
  >;

export interface SessionCreationRequest {
  protocol: string;
  fileName: string;
  fileExtension: string;
  fileSizeBytes: number;
  consentAccepted: boolean;
}

export interface SessionCreationResponse {
  session: SessionSummaryResponse;
}

export interface EegUploadRequest {
  sessionId: string;
  fileName: string;
  fileExtension: string;
  fileSizeBytes: number;
  protocol: string;
}

export interface EegUploadResponse {
  sessionId: string;
  status: SessionSummaryResponse["status"];
}

export interface AnalysisStatusResponse {
  sessionId: string;
  status: SessionSummaryResponse["status"];
}

export interface SessionAnalysisResponse {
  sessionId: string;
  signalQuality?: number | null;
  focusIndex?: number | null;
  focusTrend?: FocusTrendPoint[];
  bandPower?: BandPowerPoint[];
  provenance?: string;
}

export type ClinicianRosterResponse = Pick<
  ClinicianOverview,
  "roster" | "reviewQueue"
>;

export interface ClinicianParticipantResponse {
  participant: ClinicianParticipant;
  sessions?: SessionSummaryResponse[];
}

export type ActivityDefinitionsResponse = CognitiveActivityDefinition[];

export interface ActivityRunSubmissionRequest {
  participantId: string;
  activityId: "cpt";
  mode: "practice" | "scored";
  events: CptTrialEvent[];
}

export type CptRunResponse = Omit<CptRunSummary, "isDemo">;

export interface ActivityHistoryResponse {
  runs: CptRunResponse[];
}

/** Progress is derived from the returned scored runs using the existing CPT helpers. */
export interface ActivityProgressResponse {
  runs: CptRunResponse[];
  aggregate?: CptMetrics;
}

/** The existing UI derives profile summaries from source runs; no model output is implied. */
export interface DigitalTwinProfileResponse {
  sourceRuns: CptRunResponse[];
  traits?: DigitalTwinTrait[];
}

export type ResearchModelsResponse = ModelEvaluation[];
export type ResearchExperimentsResponse = ResearchExperiment[];
export type ResearchDatasetsResponse = Array<
  Omit<ResearchDataset, "localFileVerified"> & {
    localFileVerified?: boolean;
  }
>;

export interface ExplainabilityResponse {
  metadata: ResearchExplainability;
  featureImportance?: FeatureImportancePoint[];
}

export interface ResearchApiContracts {
  participantSummary: ApiOperation<
    { participantId: string },
    ParticipantSummaryResponse
  >;
  clinicianRoster: ApiOperation<void, ClinicianRosterResponse>;
  clinicianParticipant: ApiOperation<
    { participantId: string },
    ClinicianParticipantResponse
  >;
  createSession: ApiOperation<SessionCreationRequest, SessionCreationResponse>;
  uploadEeg: ApiOperation<EegUploadRequest, EegUploadResponse>;
  analysisStatus: ApiOperation<{ sessionId: string }, AnalysisStatusResponse>;
  sessionAnalysis: ApiOperation<{ sessionId: string }, SessionAnalysisResponse>;
  activityDefinitions: ApiOperation<void, ActivityDefinitionsResponse>;
  submitCptRun: ApiOperation<ActivityRunSubmissionRequest, CptRunResponse>;
  activityHistory: ApiOperation<
    { participantId: string },
    ActivityHistoryResponse
  >;
  activityProgress: ApiOperation<
    { participantId: string },
    ActivityProgressResponse
  >;
  digitalTwinProfile: ApiOperation<
    { participantId: string },
    DigitalTwinProfileResponse
  >;
  researchModels: ApiOperation<void, ResearchModelsResponse>;
  researchExperiments: ApiOperation<void, ResearchExperimentsResponse>;
  researchDatasets: ApiOperation<void, ResearchDatasetsResponse>;
  explainability: ApiOperation<void, ExplainabilityResponse>;
}

/** Example error body for backend discussion only; not consumed as a verified schema. */
export interface ProposedApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}
