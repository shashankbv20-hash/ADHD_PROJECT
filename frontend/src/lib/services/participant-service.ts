import { demoParticipantService } from "@/lib/services/demo/participant-service";
import { firebaseParticipantService } from "@/lib/services/firebase-services";
import { remoteParticipantService } from "@/lib/services/remote-services";
import { selectDataProvider } from "@/lib/services/service-provider";

export type { ParticipantService } from "@/lib/services/contracts";

export const participantService = selectDataProvider(
  demoParticipantService,
  remoteParticipantService,
  firebaseParticipantService,
);
