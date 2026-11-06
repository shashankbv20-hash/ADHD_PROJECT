import { demoClinicianOverview } from "@/data/demo/clinician";
import type { ClinicianService } from "@/lib/services/contracts";

export const demoClinicianService: ClinicianService = {
  async getOverview() {
    return demoClinicianOverview;
  },

  async getParticipant(participantId) {
    return (
      demoClinicianOverview.roster.find(
        (participant) => participant.id === participantId,
      ) ?? null
    );
  },
};
