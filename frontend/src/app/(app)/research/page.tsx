import type { Metadata } from "next";
import { ResearchDashboard } from "@/features/research/research-dashboard";
import { demoResearchService } from "@/lib/services/demo/research-service";
import { loadDemoService } from "@/lib/services/service-provider";

export const metadata: Metadata = {
  title: "Research dashboard",
  description:
    "Synthetic research workspace overview with model, experiment, dataset, and explainability availability states.",
};

export default async function ResearchPage() {
  const result = await loadDemoService(
    () => demoResearchService.getOverview(),
    "researcher",
  );

  if (!result.available) {
    return null;
  }

  return <ResearchDashboard overview={result.data} />;
}
