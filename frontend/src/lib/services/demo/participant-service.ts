import {
  DEMO_PARTICIPANT_ID,
  demoParticipantDashboard,
  demoSessions,
} from "@/data/demo/participant";
import { ServiceUnavailableError } from "@/lib/api-client";
import type { ParticipantService } from "@/lib/services/contracts";

function assertDemoParticipant(participantId: string): void {
  if (participantId !== DEMO_PARTICIPANT_ID) {
    throw new ServiceUnavailableError(
      "Only the demonstration participant is available in this frontend prototype.",
    );
  }
}

export const demoParticipantService: ParticipantService = {
  async getDashboard(participantId) {
    assertDemoParticipant(participantId);
    return demoParticipantDashboard;
  },

  async listSessions(participantId) {
    assertDemoParticipant(participantId);
    return demoSessions;
  },
};
