import type { Metadata } from "next";
import { ResearchExplainability } from "@/features/research/research-explainability";
import { demoResearchService } from "@/lib/services/demo/research-service";
import { loadDemoService } from "@/lib/services/service-provider";

export const metadata: Metadata = {
  title: "Explainability",
  description:
    "Illustrative feature-importance fixture with explicit unavailable attribution outputs and limitations.",
};

export default async function ResearchExplainabilityPage() {
  const result = await loadDemoService(
    () => demoResearchService.getOverview(),
    "researcher",
  );

  if (!result.available) {
    return null;
  }

  return <ResearchExplainability overview={result.data} />;
}
