import type { Metadata } from "next";
import { ResearchModelComparison } from "@/features/research/research-model-comparison";
import { demoResearchService } from "@/lib/services/demo/research-service";
import { loadDemoService } from "@/lib/services/service-provider";

export const metadata: Metadata = {
  title: "Model comparison",
  description:
    "Synthetic model metadata comparison with illustrative metrics and explicit unavailable evaluation outputs.",
};

export default async function ResearchModelsPage() {
  const result = await loadDemoService(
    () => demoResearchService.getOverview(),
    "researcher",
  );

  if (!result.available) {
    return null;
  }

  return <ResearchModelComparison overview={result.data} />;
}
