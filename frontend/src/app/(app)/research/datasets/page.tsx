import type { Metadata } from "next";
import { ResearchDatasetInventory } from "@/features/research/research-dataset-inventory";
import { demoResearchService } from "@/lib/services/demo/research-service";
import { loadDemoService } from "@/lib/services/service-provider";

export const metadata: Metadata = {
  title: "Dataset inventory",
  description:
    "Synthetic dataset metadata inventory with availability and local-file verification states.",
};

export default async function ResearchDatasetsPage() {
  const result = await loadDemoService(
    () => demoResearchService.getOverview(),
    "researcher",
  );

  if (!result.available) {
    return null;
  }

  return (
    <ResearchDatasetInventory
      datasets={result.data.datasets}
      meta={result.data.meta}
    />
  );
}
