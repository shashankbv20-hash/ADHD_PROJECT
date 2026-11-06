import type { Metadata } from "next";
import { Suspense } from "react";
import { ResearchExperimentDetail } from "@/features/research/research-experiment-detail";
import { ResearchExperimentLoading } from "@/features/research/research-experiment-loading";
import { ResearchExperimentNotFound } from "@/features/research/research-experiment-not-found";
import { demoResearchService } from "@/lib/services/demo/research-service";
import { loadDemoService } from "@/lib/services/service-provider";

export const instant = false;

interface ExperimentDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ExperimentDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await loadDemoService(
    () => demoResearchService.getExperiment(id),
    "researcher",
  );

  if (!result.available) {
    return {
      title: "Experiment detail",
      description: "Research experiment detail is unavailable in remote mode until backend contracts are confirmed.",
    };
  }

  const experiment = result.data;

  return {
    title: experiment ? experiment.name : "Experiment not found",
    description: experiment
      ? `Synthetic research experiment plan ${experiment.id}. No execution or result records exist.`
      : "The requested synthetic research experiment record does not exist.",
  };
}

async function ExperimentDetailContent({
  params,
}: ExperimentDetailPageProps) {
  const { id } = await params;
  const result = await loadDemoService(
    () =>
      Promise.all([
        demoResearchService.getExperiment(id),
        demoResearchService.getOverview(),
      ]),
    "researcher",
  );

  if (!result.available) {
    return null;
  }

  const [experiment, overview] = result.data;

  if (!experiment) {
    return <ResearchExperimentNotFound experimentId={id} />;
  }

  return (
    <ResearchExperimentDetail
      experiment={experiment}
      datasets={overview.datasets}
      models={overview.models}
      meta={overview.meta}
    />
  );
}

export default function ExperimentDetailPage({
  params,
}: ExperimentDetailPageProps) {
  return (
    <Suspense fallback={<ResearchExperimentLoading />}>
      <ExperimentDetailContent params={params} />
    </Suspense>
  );
}
