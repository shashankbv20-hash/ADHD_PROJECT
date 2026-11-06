import { demoResearchService } from "@/lib/services/demo/research-service";
import { firebaseResearchService } from "@/lib/services/firebase-services";
import { remoteResearchService } from "@/lib/services/remote-services";
import { selectDataProvider } from "@/lib/services/service-provider";

export type { ResearchService } from "@/lib/services/contracts";

export const researchService = selectDataProvider(
  demoResearchService,
  remoteResearchService,
  firebaseResearchService,
);
