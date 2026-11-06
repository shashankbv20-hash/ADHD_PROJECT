import { formatPercent } from "@/lib/utils";
import type {
  ModelEvaluation,
  ResearchDataset,
  ResearchExperiment,
  ResearchOverview,
} from "@/types";

export interface ResearchDashboardSummary {
  datasetCount: number;
  sessionOnlyDatasetCount: number;
  localVerifiedDatasetCount: number;
  experimentCount: number;
  plannedExperimentCount: number;
  inProgressExperimentCount: number;
  experimentWithResultsCount: number;
  modelCount: number;
  modelsWithMetrics: number;
  modelsAwaitingMetrics: number;
  evaluatedModelCount: number;
  explainabilityOutputCount: number;
}

export function modelHasMetrics(model: ModelEvaluation): boolean {
  return (
    model.accuracy !== null ||
    model.precision !== null ||
    model.recall !== null ||
    model.f1 !== null ||
    model.auc !== null
  );
}

export function buildResearchDashboardSummary(
  overview: ResearchOverview,
): ResearchDashboardSummary {
  return {
    datasetCount: overview.datasets.length,
    sessionOnlyDatasetCount: overview.datasets.filter(
      (dataset) => dataset.availability === "session-only",
    ).length,
    localVerifiedDatasetCount: overview.datasets.filter(
      (dataset) => dataset.localFileVerified,
    ).length,
    experimentCount: overview.experiments.length,
    plannedExperimentCount: overview.experiments.filter(
      (experiment) => experiment.status === "planned",
    ).length,
    inProgressExperimentCount: overview.experiments.filter(
      (experiment) => experiment.status === "in-progress",
    ).length,
    experimentWithResultsCount: overview.experiments.filter(
      (experiment) => experiment.resultsAvailable,
    ).length,
    modelCount: overview.models.length,
    modelsWithMetrics: overview.models.filter(modelHasMetrics).length,
    modelsAwaitingMetrics: overview.models.filter(
      (model) => !modelHasMetrics(model),
    ).length,
    evaluatedModelCount: overview.models.filter(
      (model) => model.status === "evaluated",
    ).length,
    explainabilityOutputCount: overview.explainability.availableOutputs.length,
  };
}

export function getDatasetById(
  datasets: readonly ResearchDataset[],
  datasetId: string,
): ResearchDataset | null {
  return datasets.find((dataset) => dataset.id === datasetId) ?? null;
}

export function getExperimentDatasetNames(
  experiment: ResearchExperiment,
  datasets: readonly ResearchDataset[],
): string[] {
  return experiment.datasetIds.map(
    (datasetId) => getDatasetById(datasets, datasetId)?.name ?? datasetId,
  );
}

export function getExperimentModelNames(
  experiment: ResearchExperiment,
  models: readonly ModelEvaluation[],
): string[] {
  return experiment.modelIds.map(
    (modelId) =>
      models.find((model) => model.id === modelId)?.name ?? modelId,
  );
}

export function formatResearchMetric(value: number | null): string {
  return value === null
    ? "Not provided"
    : formatPercent(value, { fromRatio: true, digits: 0 });
}
