import {
  ArrowRight,
  ClipboardList,
  Database,
  FlaskConical,
  GitCompare,
  Network,
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  buildResearchDashboardSummary,
  formatResearchMetric,
} from "@/features/research/research-data";
import { ResearchMetricCard } from "@/features/research/research-metric-card";
import {
  researchDatasetAvailabilityConfig,
  researchExperimentStatusConfig,
  researchModelStatusConfig,
} from "@/features/research/research-status";
import { formatDate } from "@/lib/utils";
import type { ResearchOverview } from "@/types";

const researchLinks = [
  {
    href: "/research/models",
    label: "Model comparison",
    description:
      "Review model metadata, illustrative metrics, unavailable fields, and provenance.",
    icon: GitCompare,
  },
  {
    href: "/research/experiments",
    label: "Experiments",
    description:
      "Browse synthetic experiment plans, lifecycle status, and detail views.",
    icon: ClipboardList,
  },
  {
    href: "/research/datasets",
    label: "Dataset inventory",
    description:
      "Inspect documented metadata, availability states, and missing dataset fields.",
    icon: Database,
  },
  {
    href: "/research/explainability",
    label: "Explainability",
    description:
      "Review the illustrative attribution preview and unavailable output states.",
    icon: Network,
  },
];

export function ResearchDashboard({ overview }: { overview: ResearchOverview }) {
  const summary = buildResearchDashboardSummary(overview);
  const hasModels = overview.models.length > 0;
  const hasDatasets = overview.datasets.length > 0;
  const hasExperiments = overview.experiments.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Research workspace"
        title="Research dashboard"
        description="A frontend research workspace for synthetic model metadata, experiment plans, dataset inventory, and explainability placeholders. No training, inference, experiment execution, or validated results are connected."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning" dot>
              Synthetic research data
            </Badge>
            <span className="text-xs text-ink-subtle">
              Snapshot {formatDate(overview.meta.snapshotDate)} · not validated
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink href="/research/models">
              <GitCompare aria-hidden="true" className="size-4" />
              Model comparison
            </ButtonLink>
            <ButtonLink href="/research/experiments" variant="outline">
              Experiments
              <ArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </>
        }
      />

      <DemoNotice meta={overview.meta} />

      <Alert tone="warning" title="Research records are illustrative">
        Model metrics, experiment records, dataset metadata, and feature
        importance are synthetic fixtures for interface review. They do not
        establish trained models, executed experiments, verified datasets, or
        validated findings.
      </Alert>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ResearchMetricCard
          icon={Database}
          label="Dataset records"
          value={String(summary.datasetCount)}
          detail={`${summary.localVerifiedDatasetCount} verified local file${
            summary.localVerifiedDatasetCount === 1 ? "" : "s"
          } · ${summary.sessionOnlyDatasetCount} session-only`}
        />
        <ResearchMetricCard
          icon={ClipboardList}
          label="Experiment records"
          value={String(summary.experimentCount)}
          detail={`${summary.plannedExperimentCount} planned · ${summary.inProgressExperimentCount} in progress · ${summary.experimentWithResultsCount} with results`}
        />
        <ResearchMetricCard
          icon={GitCompare}
          label="Model entries"
          value={String(summary.modelCount)}
          detail={`${summary.modelsWithMetrics} with illustrative metrics · ${summary.modelsAwaitingMetrics} awaiting data`}
        />
        <ResearchMetricCard
          icon={Network}
          label="Explainability"
          value={
            overview.explainability.status === "illustrative"
              ? "Illustrative"
              : "Unavailable"
          }
          detail={`${summary.explainabilityOutputCount} available output${
            summary.explainabilityOutputCount === 1 ? "" : "s"
          } · channel and temporal attribution unavailable`}
        />
      </dl>

      <section aria-labelledby="research-capabilities-heading" className="space-y-3">
        <div>
          <h2
            id="research-capabilities-heading"
            className="text-sm font-semibold text-ink"
          >
            Research capabilities
          </h2>
          <p className="mt-0.5 text-xs text-ink-subtle">
            Connected frontend views. Each page exposes its own unavailable and
            missing-data states.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {researchLinks.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-w-0 flex-col rounded-xl border border-line bg-surface p-5 shadow-card transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Icon aria-hidden="true" className="size-[18px]" />
              </span>
              <span className="mt-4 text-sm font-semibold text-ink">{label}</span>
              <span className="mt-1 flex-1 text-xs leading-5 text-ink-subtle">
                {description}
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-800">
                Open view
                <ArrowRight
                  aria-hidden="true"
                  className="size-3.5 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Model evaluation summary</CardTitle>
              <CardDescription>
                Illustrative metric availability by model entry.
              </CardDescription>
            </div>
            <Badge tone="warning">Not validated</Badge>
          </CardHeader>

          {hasModels ? (
            <CardContent className="space-y-2.5">
              {overview.models.map((model) => {
                const status = researchModelStatusConfig[model.status];

                return (
                  <Link
                    key={model.id}
                    href="/research/models"
                    className="flex flex-col gap-2 rounded-lg border border-line p-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {model.name}
                      </p>
                      <p className="font-mono text-[10px] text-ink-subtle">
                        {model.id} · {model.architecture} · {model.version}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ink-muted">
                        Acc {formatResearchMetric(model.accuracy)} · F1{" "}
                        {formatResearchMetric(model.f1)}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          ) : (
            <CardContent>
              <EmptyState
                icon={GitCompare}
                title="No model entries"
                description="The synthetic research fixture contains no model metadata. No metrics are inferred."
              />
            </CardContent>
          )}

          <CardFooter>
            <p className="text-xs text-ink-subtle">
              No model training, evaluation, or inference is connected.
            </p>
            <Link
              href="/research/models"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
            >
              Compare models
              <ArrowRight aria-hidden="true" className="size-3" />
            </Link>
          </CardFooter>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Dataset inventory overview</CardTitle>
            <CardDescription>
              Documented metadata and demonstration-only sources.
            </CardDescription>
          </CardHeader>

          {hasDatasets ? (
            <CardContent className="flex-1 space-y-2.5">
              {overview.datasets.map((dataset) => {
                const availability =
                  researchDatasetAvailabilityConfig[dataset.availability];

                return (
                  <div
                    key={dataset.id}
                    className="rounded-lg border border-line p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {dataset.name}
                        </p>
                        <p className="font-mono text-[10px] text-ink-subtle">
                          {dataset.id} · {dataset.modality}
                        </p>
                      </div>
                      <Badge tone={availability.tone} className="shrink-0">
                        {availability.label}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-ink-subtle">
                      {dataset.participantCount === null
                        ? "Participant count not documented"
                        : `${dataset.participantCount} participants`}
                      {" · "}
                      {dataset.localFileVerified
                        ? "Verified local file"
                        : "No verified local file"}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          ) : (
            <CardContent className="flex-1">
              <EmptyState
                icon={Database}
                title="No dataset records"
                description="No dataset metadata is available. No participant counts or file inventories are inferred."
              />
            </CardContent>
          )}

          <CardFooter>
            <p className="text-xs text-ink-subtle">
              No dataset files or access permissions are available.
            </p>
            <Link
              href="/research/datasets"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
            >
              Open inventory
              <ArrowRight aria-hidden="true" className="size-3" />
            </Link>
          </CardFooter>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Experiment summaries</CardTitle>
              <CardDescription>
                Synthetic planning records; execution is not connected.
              </CardDescription>
            </div>
            <Badge tone="outline">No execution</Badge>
          </CardHeader>

          {hasExperiments ? (
            <CardContent className="space-y-2.5">
              {overview.experiments.map((experiment) => {
                const status =
                  researchExperimentStatusConfig[experiment.status];

                return (
                  <Link
                    key={experiment.id}
                    href={`/research/experiments/${experiment.id}`}
                    className="flex flex-col gap-2 rounded-lg border border-line p-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {experiment.name}
                      </p>
                      <p className="font-mono text-[10px] text-ink-subtle">
                        {experiment.id} · Updated{" "}
                        {formatDate(experiment.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <Badge tone="outline">Results not recorded</Badge>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          ) : (
            <CardContent>
              <EmptyState
                icon={ClipboardList}
                title="No experiment records"
                description="No experiment plans are available. No execution or result records are inferred."
              />
            </CardContent>
          )}

          <CardFooter>
            <p className="text-xs text-ink-subtle">
              Experiment execution and result storage are unavailable.
            </p>
            <Link
              href="/research/experiments"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
            >
              Open experiments
              <ArrowRight aria-hidden="true" className="size-3" />
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Result provenance</CardTitle>
            <CardDescription>
              What the current demonstration snapshot represents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-line/70">
              {overview.provenance.map((record) => (
                <div key={record.label} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                    {record.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-ink">
                    {record.value}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-ink-muted">
                    {record.detail}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-ink-subtle">
              Provenance fields are ready for future backend contracts.
            </p>
            <FlaskConical
              aria-hidden="true"
              className="size-4 text-ink-subtle"
            />
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
