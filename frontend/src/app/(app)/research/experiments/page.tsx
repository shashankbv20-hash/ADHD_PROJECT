import type { Metadata } from "next";
import { ResearchExperimentList } from "@/features/research/research-experiment-list";
import { demoResearchService } from "@/lib/services/demo/research-service";
import { loadDemoService } from "@/lib/services/service-provider";

export const metadata: Metadata = {
  title: "Experiments",
  description:
    "Synthetic experiment plans with explicit lifecycle, execution, dataset, and model metadata states.",
};

export default async function ResearchExperimentsPage() {
  const result = await loadDemoService(
    () => demoResearchService.getOverview(),
    "researcher",
  );

  if (!result.available) {
    return null;
  }

  return (
    <ResearchExperimentList
      experiments={result.data.experiments}
      datasets={result.data.datasets}
      models={result.data.models}
      meta={result.data.meta}
    />
  );
}
