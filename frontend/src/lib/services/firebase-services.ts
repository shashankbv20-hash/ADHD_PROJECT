import { demoCognitiveActivities } from "@/data/demo/activities";
import { ServiceUnavailableError } from "@/lib/api-client";
import type {
  ActivityService,
  ClinicianService,
  ParticipantService,
  ResearchService,
} from "@/lib/services/contracts";

function participantDataNotSupported(operation: string): ServiceUnavailableError {
  return new ServiceUnavailableError(
    `ParticipantService.${operation} does not use synthetic EEG dashboard data in Firebase mode. The signed-in participant profile and CPT summaries are provided by Firebase account services; EEG analysis remains unavailable.`,
    "unsupported",
  );
}

export const firebaseParticipantService: ParticipantService = {
  async getDashboard() {
    throw participantDataNotSupported("getDashboard");
  },

  async listSessions() {
    throw participantDataNotSupported("listSessions");
  },
};

export const firebaseActivityService: ActivityService = {
  async listActivities() {
    return demoCognitiveActivities;
  },

  async getActivity(activityId) {
    return demoCognitiveActivities.find((activity) => activity.id === activityId);
  },
};

export const firebaseClinicianService: ClinicianService = {
  async getOverview() {
    throw new ServiceUnavailableError(
      "Clinician data is not available through participant Firebase accounts. Staff authorization requires a separate trusted design.",
      "unsupported",
    );
  },

  async getParticipant() {
    throw new ServiceUnavailableError(
      "Participant roster access is unavailable to Firebase participant accounts.",
      "unsupported",
    );
  },
};

export const firebaseResearchService: ResearchService = {
  async getOverview() {
    throw new ServiceUnavailableError(
      "Research model, dataset, and experiment services remain demonstration-only in Firebase participant mode.",
      "unsupported",
    );
  },

  async getExperiment() {
    throw new ServiceUnavailableError(
      "Research experiment records are unavailable from Firebase participant accounts.",
      "unsupported",
    );
  },
};
