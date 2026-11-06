"use client";

import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Database,
  GitCompare,
  Search,
  SearchX,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  getExperimentDatasetNames,
  getExperimentModelNames,
} from "@/features/research/research-data";
import {
  researchExecutionStatusConfig,
  researchExperimentStatusConfig,
} from "@/features/research/research-status";
import { cn, formatDate } from "@/lib/utils";
import type {
  DemoMeta,
  ModelEvaluation,
  ResearchDataset,
  ResearchExperiment,
  ResearchExperimentStatus,
} from "@/types";

type StatusFilter = "all" | ResearchExperimentStatus;

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "unavailable", label: "Unavailable" },
];

export function ResearchExperimentList({
  experiments,
  datasets,
  models,
  meta,
}: {
  experiments: ResearchExperiment[];
  datasets: ResearchDataset[];
  models: ModelEvaluation[];
  meta: DemoMeta;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const normalizedQuery = query.trim().toLowerCase();

  const filteredExperiments = useMemo(
    () =>
      experiments.filter((experiment) => {
        const matchesStatus =
          statusFilter === "all" || experiment.status === statusFilter;
        const searchableValues = [
          experiment.id,
          experiment.name,
          experiment.researchQuestion,
          experiment.methodology,
          researchExperimentStatusConfig[experiment.status].label,
          researchExecutionStatusConfig[experiment.executionStatus].label,
          ...getExperimentDatasetNames(experiment, datasets),
          ...getExperimentModelNames(experiment, models),
        ];
        const matchesQuery =
          !normalizedQuery ||
          searchableValues.some((value) =>
            value.toLowerCase().includes(normalizedQuery),
          );

        return matchesStatus && matchesQuery;
      }),
    [datasets, experiments, models, normalizedQuery, statusFilter],
  );

  const countFor = (value: StatusFilter) =>
    value === "all"
      ? experiments.length
      : experiments.filter((experiment) => experiment.status === value).length;

  function resetFilters() {
    setStatusFilter("all");
    setQuery("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Research workspace"
        title="Experiments"
        description="Browse synthetic experiment plans and review their metadata, status, dataset relationships, model references, limitations, and reproducibility notes."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning" dot>
              Synthetic experiment records
            </Badge>
            <span className="text-xs text-ink-subtle">
              {experiments.length} plan{experiments.length === 1 ? "" : "s"} · no
              execution
            </span>
          </div>
        }
        actions={
          <ButtonLink href="/research" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Research dashboard
          </ButtonLink>
        }
      />

      <DemoNotice meta={meta} />

      <Alert tone="info" title="Plans, not executed experiments">
        Lifecycle labels describe synthetic planning records. No experiment has
        been executed, no results have been recorded, and experiment creation or
        editing is not available.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Experiment inventory</CardTitle>
          <CardDescription>
            Search by identifier, title, research question, dataset, or model.
            Filter by synthetic lifecycle status.
          </CardDescription>
        </CardHeader>

        {experiments.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={ClipboardList}
              title="No experiment records"
              description="No experiment plans are available. No execution or result records are inferred."
              action={
                <ButtonLink href="/research" variant="outline">
                  Back to research dashboard
                </ButtonLink>
              }
            />
          </CardContent>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div
                role="group"
                aria-label="Filter experiments by lifecycle status"
                className="flex flex-wrap gap-1.5"
              >
                {statusFilters.map((option) => {
                  const active = statusFilter === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStatusFilter(option.value)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-ink bg-ink text-white"
                          : "border-line bg-surface text-ink-muted hover:border-line-strong hover:bg-slate-50",
                      )}
                    >
                      {option.label}
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none",
                          active
                            ? "bg-white/15 text-white"
                            : "bg-slate-100 text-ink-subtle",
                        )}
                      >
                        {countFor(option.value)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full lg:max-w-xs">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search experiments"
                  aria-label="Search experiments"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="border-b border-line px-5 py-2.5">
              <p aria-live="polite" className="text-xs text-ink-subtle">
                Showing {filteredExperiments.length} of {experiments.length}{" "}
                experiment{experiments.length === 1 ? "" : "s"}.
              </p>
            </div>

            {filteredExperiments.length === 0 ? (
              <CardContent className="py-6">
                <EmptyState
                  icon={SearchX}
                  title="No matching experiments"
                  description="No synthetic experiment records match the current search and status filter. Adjust the query or clear the filters."
                  action={
                    <Button variant="outline" onClick={resetFilters}>
                      Clear filters
                    </Button>
                  }
                />
              </CardContent>
            ) : (
              <CardContent className="space-y-3">
                {filteredExperiments.map((experiment) => {
                  const status =
                    researchExperimentStatusConfig[experiment.status];
                  const execution =
                    researchExecutionStatusConfig[experiment.executionStatus];
                  const datasetNames = getExperimentDatasetNames(
                    experiment,
                    datasets,
                  );
                  const modelNames = getExperimentModelNames(
                    experiment,
                    models,
                  );

                  return (
                    <article
                      key={experiment.id}
                      className="rounded-xl border border-line p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-ink">
                              {experiment.name}
                            </h3>
                            <Badge tone={status.tone}>{status.label}</Badge>
                            <Badge tone="outline">{execution.label}</Badge>
                          </div>
                          <p className="font-mono text-[10px] text-ink-subtle">
                            {experiment.id} · Updated{" "}
                            {formatDate(experiment.updatedAt)}
                          </p>
                          <p className="max-w-3xl text-xs leading-5 text-ink-muted">
                            {experiment.researchQuestion}
                          </p>
                        </div>

                        <ButtonLink
                          href={`/research/experiments/${experiment.id}`}
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          aria-label={`Open experiment ${experiment.name}`}
                        >
                          Open detail
                          <ArrowRight
                            aria-hidden="true"
                            className="size-3.5"
                          />
                        </ButtonLink>
                      </div>

                      <dl className="mt-4 grid gap-3 border-t border-line/70 pt-3 sm:grid-cols-3">
                        <div>
                          <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                            <Database
                              aria-hidden="true"
                              className="size-3"
                            />
                            Dataset references
                          </dt>
                          <dd className="mt-1 text-xs leading-5 text-ink-muted">
                            {datasetNames.length > 0
                              ? datasetNames.join(", ")
                              : "None linked"}
                          </dd>
                        </div>
                        <div>
                          <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                            <GitCompare
                              aria-hidden="true"
                              className="size-3"
                            />
                            Model references
                          </dt>
                          <dd className="mt-1 text-xs leading-5 text-ink-muted">
                            {modelNames.length > 0
                              ? modelNames.join(", ")
                              : "None linked"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                            Results
                          </dt>
                          <dd className="mt-1 text-xs leading-5 text-ink-muted">
                            {experiment.resultsAvailable
                              ? "Result records available"
                              : "No result records"}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  );
                })}
              </CardContent>
            )}
          </>
        )}

        <CardFooter>
          <p className="text-xs text-ink-subtle">
            Experiment execution, editing, and result storage are unavailable.
          </p>
          <Link
            href="/research/models"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
          >
            Model comparison
            <ArrowRight aria-hidden="true" className="size-3" />
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
