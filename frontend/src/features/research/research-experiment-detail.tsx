import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CircleSlash2,
  ClipboardList,
  Database,
  GitCompare,
} from "lucide-react";
import Link from "next/link";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDatasetById } from "@/features/research/research-data";
import { ResearchMetricCard } from "@/features/research/research-metric-card";
import {
  ResearchAvailabilityRow,
  ResearchDetailRow,
} from "@/features/research/research-rows";
import {
  researchDatasetAvailabilityConfig,
  researchExecutionStatusConfig,
  researchExperimentStatusConfig,
  researchModelStatusConfig,
} from "@/features/research/research-status";
import { formatDate, formatDateTime } from "@/lib/utils";
import type {
  DemoMeta,
  ModelEvaluation,
  ResearchDataset,
  ResearchExperiment,
} from "@/types";

export function ResearchExperimentDetail({
  experiment,
  datasets,
  models,
  meta,
}: {
  experiment: ResearchExperiment;
  datasets: ResearchDataset[];
  models: ModelEvaluation[];
  meta: DemoMeta;
}) {
  const status = researchExperimentStatusConfig[experiment.status];
  const execution = researchExecutionStatusConfig[experiment.executionStatus];
  const linkedDatasets = experiment.datasetIds.map((datasetId) =>
    getDatasetById(datasets, datasetId),
  );
  const linkedModels = experiment.modelIds.map(
    (modelId) => models.find((model) => model.id === modelId) ?? null,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Research workspace"
        title={experiment.name}
        description={`Synthetic experiment record ${experiment.id}. The lifecycle status describes a planning fixture, not an executed experiment or a recorded result.`}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone="outline">{execution.label}</Badge>
            <span className="font-mono text-xs text-ink-subtle">
              {experiment.id}
            </span>
            <span className="text-xs text-ink-subtle">
              Updated {formatDate(experiment.updatedAt)}
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink href="/research/experiments" variant="outline">
              <ArrowLeft aria-hidden="true" className="size-4" />
              All experiments
            </ButtonLink>
            <ButtonLink href="/research/models" variant="outline">
              Model comparison
              <ArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </>
        }
      />

      <DemoNotice meta={meta} />

      <Alert tone="warning" title="No execution or result record">
        This page describes a synthetic experiment plan. No experiment runner,
        background job, result store, or editing workflow is connected. Status
        labels must not be read as evidence that an experiment ran.
      </Alert>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ResearchMetricCard
          icon={ClipboardList}
          label="Lifecycle status"
          value={status.label}
          detail="Synthetic planning state."
        />
        <ResearchMetricCard
          icon={CircleSlash2}
          label="Execution"
          value={execution.label}
          detail={execution.description}
        />
        <ResearchMetricCard
          icon={Database}
          label="Dataset references"
          value={String(experiment.datasetIds.length)}
          detail="Metadata references only; no dataset files."
        />
        <ResearchMetricCard
          icon={GitCompare}
          label="Model references"
          value={String(experiment.modelIds.length)}
          detail="Synthetic model metadata; no evaluation run."
        />
      </dl>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Research question and methodology</CardTitle>
            <CardDescription>
              Plan-level context from the synthetic fixture.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
                Research question
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                {experiment.researchQuestion}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
                Methodology summary
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                {experiment.methodology}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
                Results
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                {experiment.resultsAvailable
                  ? "Result records are available."
                  : "No result records exist. No outcome, metric, or conclusion is inferred."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status and provenance</CardTitle>
            <CardDescription>
              Explicit planning and execution states.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResearchDetailRow
              label="Experiment ID"
              value={experiment.id}
              detail="Synthetic fixture identifier."
            />
            <ResearchDetailRow
              label="Lifecycle status"
              value={status.label}
              detail="Planning state, not an execution result."
            />
            <ResearchDetailRow
              label="Execution status"
              value={execution.label}
              detail={execution.description}
            />
            <ResearchDetailRow
              label="Results available"
              value={experiment.resultsAvailable ? "Yes" : "No"}
              detail="No result records are generated by this frontend."
            />
            <ResearchDetailRow
              label="Last updated"
              value={`${formatDateTime(experiment.updatedAt)} UTC`}
              detail="Synthetic fixture timestamp."
            />
            <ResearchDetailRow
              label="Source"
              value="Local demo fixture"
              detail="No backend, experiment runner, or result database is connected."
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dataset references</CardTitle>
            <CardDescription>
              Metadata relationships from the synthetic fixture.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {linkedDatasets.length === 0 ? (
              <p className="text-sm leading-6 text-ink-muted">
                No dataset references are assigned to this experiment.
              </p>
            ) : (
              linkedDatasets.map((dataset, index) => {
                const datasetId = experiment.datasetIds[index];

                if (!dataset) {
                  return (
                    <div
                      key={datasetId}
                      className="rounded-lg border border-line p-3.5"
                    >
                      <p className="font-mono text-xs text-ink">{datasetId}</p>
                      <p className="mt-1 text-xs text-ink-subtle">
                        Referenced dataset metadata is unavailable.
                      </p>
                    </div>
                  );
                }

                const availability =
                  researchDatasetAvailabilityConfig[dataset.availability];

                return (
                  <Link
                    key={dataset.id}
                    href="/research/datasets"
                    className="flex items-start justify-between gap-3 rounded-lg border border-line p-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {dataset.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-ink-subtle">
                        {dataset.id} · {dataset.modality}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-ink-subtle">
                        {dataset.participantCount === null
                          ? "Participant count not documented"
                          : `${dataset.participantCount} participants`}
                      </p>
                    </div>
                    <Badge tone={availability.tone} className="shrink-0">
                      {availability.label}
                    </Badge>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model references</CardTitle>
            <CardDescription>
              Metadata references, not evaluation outcomes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {linkedModels.length === 0 ? (
              <p className="text-sm leading-6 text-ink-muted">
                No model references are assigned to this experiment.
              </p>
            ) : (
              linkedModels.map((model, index) => {
                const modelId = experiment.modelIds[index];

                if (!model) {
                  return (
                    <div
                      key={modelId}
                      className="rounded-lg border border-line p-3.5"
                    >
                      <p className="font-mono text-xs text-ink">{modelId}</p>
                      <p className="mt-1 text-xs text-ink-subtle">
                        Referenced model metadata is unavailable.
                      </p>
                    </div>
                  );
                }

                const modelStatus = researchModelStatusConfig[model.status];

                return (
                  <Link
                    key={model.id}
                    href="/research/models"
                    className="flex items-start justify-between gap-3 rounded-lg border border-line p-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {model.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-ink-subtle">
                        {model.id} · {model.architecture} · {model.version}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-ink-subtle">
                        {model.evaluationStatus}
                      </p>
                    </div>
                    <Badge tone={modelStatus.tone} className="shrink-0">
                      {modelStatus.label}
                    </Badge>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Known limitations</CardTitle>
            <CardDescription>
              Constraints that apply to this synthetic plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-ink-muted">
              {experiment.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reproducibility notes</CardTitle>
            <CardDescription>
              Available plan-level reproducibility information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-ink-muted">
              {experiment.reproducibility.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Experiment controls</CardTitle>
          <CardDescription>
            Operations that are not available in this frontend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResearchAvailabilityRow
            label="Create or edit experiment"
            status="Unavailable"
            tone="outline"
            description="No persistent experiment store or editing workflow exists."
          />
          <ResearchAvailabilityRow
            label="Execute experiment"
            status="Not connected"
            tone="outline"
            description="No runner, queue, background job, or compute service exists."
          />
          <ResearchAvailabilityRow
            label="Record or inspect results"
            status="Unavailable"
            tone="outline"
            description="No result schema, result store, or analysis output is available."
          />
          <ResearchAvailabilityRow
            label="Assign datasets or models"
            status="Read-only metadata"
            tone="outline"
            description="Relationships come from the synthetic fixture and cannot be changed."
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/research/experiments" variant="outline">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to experiments
        </ButtonLink>
        <ButtonLink href="/research/datasets" variant="outline">
          <CalendarClock aria-hidden="true" className="size-4" />
          Dataset inventory
        </ButtonLink>
      </div>
    </div>
  );
}
