import { demoCognitiveActivities } from "@/data/demo/activities";
import type { ActivityService } from "@/lib/services/contracts";

export const demoActivityService: ActivityService = {
  async listActivities() {
    return demoCognitiveActivities;
  },

  async getActivity(activityId) {
    return demoCognitiveActivities.find(
      (activity) => activity.id === activityId,
    );
  },
};
