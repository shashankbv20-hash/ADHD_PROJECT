import { demoActivityService } from "@/lib/services/demo/activity-service";
import { firebaseActivityService } from "@/lib/services/firebase-services";
import { remoteActivityService } from "@/lib/services/remote-services";
import { selectDataProvider } from "@/lib/services/service-provider";

export type { ActivityService } from "@/lib/services/contracts";

export const activityService = selectDataProvider(
  demoActivityService,
  remoteActivityService,
  firebaseActivityService,
);
