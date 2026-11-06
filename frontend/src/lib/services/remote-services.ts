import type {
  ActivityService,
  ClinicianService,
  ParticipantService,
  ResearchService,
} from "@/lib/services/contracts";
import { getRemoteIntegrationError } from "@/lib/services/service-provider";

export const remoteParticipantService: ParticipantService = {
  async getDashboard() {
    throw getRemoteIntegrationError("ParticipantService", "getDashboard");
  },

  async listSessions() {
    throw getRemoteIntegrationError("ParticipantService", "listSessions");
  },
};

export const remoteClinicianService: ClinicianService = {
  async getOverview() {
    throw getRemoteIntegrationError("ClinicianService", "getOverview");
  },

  async getParticipant() {
    throw getRemoteIntegrationError("ClinicianService", "getParticipant");
  },
};

export const remoteActivityService: ActivityService = {
  async listActivities() {
    throw getRemoteIntegrationError("ActivityService", "listActivities");
  },

  async getActivity() {
    throw getRemoteIntegrationError("ActivityService", "getActivity");
  },
};

export const remoteResearchService: ResearchService = {
  async getOverview() {
    throw getRemoteIntegrationError("ResearchService", "getOverview");
  },

  async getExperiment() {
    throw getRemoteIntegrationError("ResearchService", "getExperiment");
  },
};
