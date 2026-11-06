import {
  ArrowLeft,
  ArrowRight,
  CircleSlash2,
  GitCompare,
  Info,
  ListChecks,
} from "lucide-react";
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
import { modelHasMetrics } from "@/features/research/research-data";
import { ResearchMetricCard } from "@/features/research/research-metric-card";
import {
  ResearchAvailabilityRow,
  ResearchDetailRow,
} from "@/features/research/research-rows";
import { researchModelStatusConfig } from "@/features/research/research-status";
import { formatPercent } from "@/lib/utils";
import type { ModelEvaluation, ResearchOverview } from "@/types";

function formatModelMetric(value: number | null): string {
  return value === null
    ? "—"
    : formatPercent(value, { fromRatio: true, digits: 0 });
}

function ModelDetailCard({ model }: { model: ModelEvaluation }) {
  const status = researchModelStatusConfig[model.status];

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>{model.name}</CardTitle>
          <CardDescription>
            {model.id} · {model.architecture} · {model.version}
          </CardDescription>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
              Accuracy
            </dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-ink">
              {formatModelMetric(model.accuracy)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
              F1
            </dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-ink">
              {formatModelMetric(model.f1)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
              AUC
            </dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-ink">
              {formatModelMetric(model.auc)}
            </dd>
          </div>
        </dl>

        <div>
          <ResearchDetailRow
            label="Dataset label"
            value={model.dataset}
            detail="Synthetic metadata; no dataset file is verified."
          />
          <ResearchDetailRow
            label="Training status"
            value={model.trainingStatus}
            detail="No training pipeline is connected."
          />
          <ResearchDetailRow
            label="Evaluation status"
            value={model.evaluationStatus}
            detail="Metric values do not come from an evaluation run."
          />
        </div>

        <div>
          <p className="text-xs font-medium text-ink">Known limitations</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-ink-subtle">
            {model.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      </CardContent>

      <CardFooter>
        <p className="text-xs leading-5 text-ink-subtle">{model.provenance}</p>
      </CardFooter>
    </Card>
  );
}

export function ResearchModelComparison({
  overview,
}: {
  overview: ResearchOverview;
}) {
  const modelsWithMetrics = overview.models.filter(modelHasMetrics).length;
  const modelsAwaitingMetrics = overview.models.length - modelsWithMetrics;
  const evaluatedModels = overview.models.filter(
    (model) => model.status === "evaluated",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Research workspace"
        title="Model comparison"
        description="Compare synthetic model metadata and explicitly labelled illustrative metrics. No model has been trained, evaluated, or executed by this frontend."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning" dot>
              Synthetic model records
            </Badge>
            <span className="text-xs text-ink-subtle">
              {overview.models.length} model entries · no inference
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink href="/research" variant="outline">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Research dashboard
            </ButtonLink>
            <ButtonLink href="/research/experiments" variant="outline">
              Experiments
              <ArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </>
        }
      />

      <DemoNotice meta={overview.meta} />

      <Alert tone="warning" title="No validated model evaluation">
        Accuracy, F1, and AUC values in this fixture are illustrative
        placeholders. Precision and recall values are not provided. No
        prediction-level data exists, so confusion matrices and ROC curves are
        unavailable.
      </Alert>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ResearchMetricCard
          icon={GitCompare}
          label="Model entries"
          value={String(overview.models.length)}
          detail="Synthetic metadata records."
        />
        <ResearchMetricCard
          icon={ListChecks}
          label="With illustrative metrics"
          value={String(modelsWithMetrics)}
          detail="Values are placeholders, not evaluation results."
        />
        <ResearchMetricCard
          icon={CircleSlash2}
          label="Awaiting metric data"
          value={String(modelsAwaitingMetrics)}
          detail="No accuracy, precision, recall, F1, or AUC values."
        />
        <ResearchMetricCard
          icon={Info}
          label="Evaluation status"
          value={String(evaluatedModels)}
          detail="Entries labelled illustrative; no evaluation run occurred."
        />
      </dl>

      {overview.models.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <EmptyState
              icon={GitCompare}
              title="No model records"
              description="The synthetic research fixture contains no model metadata. No accuracy, F1, AUC, or comparison values are inferred."
              action={
                <ButtonLink href="/research" variant="outline">
                  Back to research dashboard
                </ButtonLink>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Model metadata and metric comparison</CardTitle>
                <CardDescription>
                  A dash means the fixture does not provide that value. No metric
                  is calculated by this interface.
                </CardDescription>
              </div>
              <Badge tone="warning">Illustrative only</Badge>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <caption className="sr-only">
                  Synthetic model comparison with metadata, illustrative
                  metrics, and explicit unavailable values
                </caption>
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-subtle">
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Model
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Architecture / version
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Dataset label
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Accuracy
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Precision
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Recall
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      F1
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      AUC
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.models.map((model) => {
                    const status = researchModelStatusConfig[model.status];

                    return (
                      <tr
                        key={model.id}
                        className="border-b border-line/70 last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-ink">
                            {model.name}
                          </p>
                          <p className="font-mono text-[10px] text-ink-subtle">
                            {model.id}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-ink-muted">
                          {model.architecture} · {model.version}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-ink-muted">
                          {model.dataset}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-muted">
                          {formatModelMetric(model.accuracy)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-muted">
                          {formatModelMetric(model.precision)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-muted">
                          {formatModelMetric(model.recall)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-muted">
                          {formatModelMetric(model.f1)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-muted">
                          {formatModelMetric(model.auc)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <CardFooter>
              <p className="text-xs leading-5 text-ink-subtle">
                No model is ranked, selected, or claimed superior. Differences
                between illustrative values are not scientific findings.
              </p>
              <Badge tone="outline">No ranking claim</Badge>
            </CardFooter>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Metric definitions</CardTitle>
                <CardDescription>
                  Definitions used for any provided values.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResearchDetailRow
                  label="Accuracy"
                  value="Correct classifications / all classifications"
                  detail="Shown as a percentage only when the fixture provides a value."
                />
                <ResearchDetailRow
                  label="Precision"
                  value="True positives / predicted positives"
                  detail="Not provided for any current model entry."
                />
                <ResearchDetailRow
                  label="Recall"
                  value="True positives / actual positives"
                  detail="Not provided for any current model entry."
                />
                <ResearchDetailRow
                  label="F1"
                  value="Harmonic mean of precision and recall"
                  detail="Illustrative values are provided for two fixture entries."
                />
                <ResearchDetailRow
                  label="AUC"
                  value="Area under the ROC curve"
                  detail="Illustrative values are provided for two fixture entries."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Unavailable visualizations</CardTitle>
                <CardDescription>
                  Outputs that require prediction-level data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResearchAvailabilityRow
                  label="Confusion matrix"
                  status="Unavailable"
                  tone="outline"
                  description="No per-class prediction counts or labels are available."
                />
                <ResearchAvailabilityRow
                  label="ROC curve"
                  status="Unavailable"
                  tone="outline"
                  description="No threshold-level true-positive or false-positive data exists."
                />
                <ResearchAvailabilityRow
                  label="Precision-recall curve"
                  status="Unavailable"
                  tone="outline"
                  description="No prediction scores or threshold sweep is available."
                />
                <ResearchAvailabilityRow
                  label="Model execution"
                  status="Not connected"
                  tone="outline"
                  description="No training, inference, or evaluation service is available."
                />
              </CardContent>
            </Card>
          </div>

          <section aria-labelledby="model-details-heading" className="space-y-3">
            <div>
              <h2
                id="model-details-heading"
                className="text-sm font-semibold text-ink"
              >
                Model details and limitations
              </h2>
              <p className="mt-0.5 text-xs text-ink-subtle">
                Metadata and provenance for each synthetic model entry.
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {overview.models.map((model) => (
                <ModelDetailCard key={model.id} model={model} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
