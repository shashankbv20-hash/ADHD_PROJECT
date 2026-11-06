import { demoResearchOverview } from "@/data/demo/research";
import type { ResearchService } from "@/lib/services/contracts";

export const demoResearchService: ResearchService = {
  async getOverview() {
    return demoResearchOverview;
  },

  async getExperiment(experimentId) {
    return (
      demoResearchOverview.experiments.find(
        (experiment) => experiment.id === experimentId,
      ) ?? null
    );
  },
};
