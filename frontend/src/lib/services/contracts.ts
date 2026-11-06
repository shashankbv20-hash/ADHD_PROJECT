import type {
  CognitiveActivityDefinition,
  CognitiveActivityId,
  ClinicianOverview,
  ClinicianParticipant,
  EegSession,
  ParticipantDashboard,
  ResearchExperiment,
  ResearchOverview,
} from "@/types";

export interface ParticipantService {
  getDashboard(participantId: string): Promise<ParticipantDashboard>;
  listSessions(participantId: string): Promise<EegSession[]>;
}

export interface ClinicianService {
  getOverview(): Promise<ClinicianOverview>;
  getParticipant(participantId: string): Promise<ClinicianParticipant | null>;
}

export interface ActivityService {
  listActivities(): Promise<CognitiveActivityDefinition[]>;
  getActivity(
    activityId: CognitiveActivityId,
  ): Promise<CognitiveActivityDefinition | undefined>;
}

export interface ResearchService {
  getOverview(): Promise<ResearchOverview>;
  getExperiment(experimentId: string): Promise<ResearchExperiment | null>;
}
