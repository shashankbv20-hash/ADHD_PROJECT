import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CircleSlash2,
  Eye,
  Info,
  ShieldAlert,
} from "lucide-react";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { FeatureImportanceChart } from "@/components/charts/feature-importance-chart";
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
import { ResearchMetricCard } from "@/features/research/research-metric-card";
import {
  ResearchAvailabilityRow,
  ResearchDetailRow,
} from "@/features/research/research-rows";
import { researchExplainabilityStatusConfig } from "@/features/research/research-status";
import type { ResearchOverview } from "@/types";

export function ResearchExplainability({
  overview,
}: {
  overview: ResearchOverview;
}) {
  const explainability = overview.explainability;
  const status = researchExplainabilityStatusConfig[explainability.status];
  const model = overview.models.find(
    (entry) => entry.id === explainability.modelId,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Research workspace"
        title="Explainability"
        description="Review an illustrative feature-importance fixture and explicit unavailable attribution outputs. Nothing on this page is computed from a trained model."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
            <span className="text-xs text-ink-subtle">
              {overview.featureImportance.length} feature values · no model
              inference
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink href="/research" variant="outline">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Research dashboard
            </ButtonLink>
            <ButtonLink href="/research/models" variant="outline">
              Model comparison
              <ArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </>
        }
      />

      <DemoNotice meta={overview.meta} />

      <Alert tone="warning" title="Illustrative feature importance only">
        The chart values are synthetic placeholders for interface review. They
        are not SHAP, permutation, attention, or other computed explanations and
        must not be interpreted as model behaviour or clinical evidence.
      </Alert>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ResearchMetricCard
          icon={Eye}
          label="Explainability status"
          value={status.label}
          detail={status.description}
        />
        <ResearchMetricCard
          icon={BarChart3}
          label="Illustrative outputs"
          value={String(explainability.availableOutputs.length)}
          detail="Synthetic values available for interface review."
        />
        <ResearchMetricCard
          icon={CircleSlash2}
          label="Unavailable outputs"
          value={String(explainability.unavailableOutputs.length)}
          detail="Outputs requiring model or signal-level data."
        />
        <ResearchMetricCard
          icon={Info}
          label="Referenced model"
          value={model ? model.name : "Not linked"}
          detail={
            model
              ? `${model.id} · ${model.architecture} · ${model.version}`
              : "No model metadata reference is available."
          }
        />
      </dl>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Illustrative feature importance</CardTitle>
              <CardDescription>
                Relative synthetic values from the local fixture. Values sum to
                approximately 1.0.
              </CardDescription>
            </div>
            <Badge tone="warning">Not computed</Badge>
          </CardHeader>
          <CardContent>
            <FeatureImportanceChart data={overview.featureImportance} />
          </CardContent>
          <CardFooter>
            <p className="text-xs leading-5 text-ink-subtle">
              No feature is causal, clinically actionable, or ranked as
              important by a real model. Hover values are fixture percentages.
            </p>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Method and provenance</CardTitle>
            <CardDescription>
              What generated the fixture values.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResearchDetailRow
              label="Status"
              value={status.label}
              detail={status.description}
            />
            <ResearchDetailRow
              label="Method"
              value={explainability.method}
              detail="A synthetic fixture, not an explanation algorithm."
            />
            <ResearchDetailRow
              label="Referenced model"
              value={
                model
                  ? `${model.name} (${model.id})`
                  : (explainability.modelId ?? "Not linked")
              }
              detail="Metadata reference only; no model is loaded or executed."
            />
            <ResearchDetailRow
              label="Dataset label"
              value={explainability.dataset}
              detail="Synthetic dataset label; no file or samples are available."
            />
          </CardContent>
          <CardFooter>
            <p className="text-xs leading-5 text-ink-subtle">
              {explainability.provenance}
            </p>
          </CardFooter>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Available fixture outputs</CardTitle>
            <CardDescription>
              Outputs represented by synthetic placeholders.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {explainability.availableOutputs.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No illustrative outputs are available.
              </p>
            ) : (
              explainability.availableOutputs.map((output) => (
                <div
                  key={output}
                  className="flex items-start gap-2 rounded-lg border border-demo-line bg-demo-soft px-3 py-2.5"
                >
                  <BarChart3
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-demo"
                  />
                  <div>
                    <p className="text-xs font-medium text-ink">{output}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-ink-subtle">
                      Synthetic values only; no attribution was computed.
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unavailable attribution outputs</CardTitle>
            <CardDescription>
              Outputs that require model, channel, or time-series data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {explainability.unavailableOutputs.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No unavailable outputs are listed.
              </p>
            ) : (
              explainability.unavailableOutputs.map((output) => (
                <ResearchAvailabilityRow
                  key={output}
                  label={output}
                  status="Unavailable"
                  tone="outline"
                  description="No underlying data or computation is connected."
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Known limitations</CardTitle>
            <CardDescription>
              Constraints that apply to every value shown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-ink-muted">
              {explainability.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What this page does not show</CardTitle>
            <CardDescription>
              Claims that require evidence not present in this demo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResearchAvailabilityRow
              label="Channel-level attribution"
              status="Unavailable"
              tone="outline"
              description="No electrode-level contribution data exists."
            />
            <ResearchAvailabilityRow
              label="Frequency-band contribution"
              status="Unavailable"
              tone="outline"
              description="No spectral decomposition or model attribution exists."
            />
            <ResearchAvailabilityRow
              label="Temporal attribution"
              status="Unavailable"
              tone="outline"
              description="No time-window importance or sequence attribution exists."
            />
            <ResearchAvailabilityRow
              label="Causal or clinical explanation"
              status="Unavailable"
              tone="outline"
              description="No causal analysis, diagnosis, or treatment recommendation exists."
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Explainability controls</CardTitle>
          <CardDescription>
            Operations that are not implemented.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResearchAvailabilityRow
            label="Generate explanation"
            status="Not connected"
            tone="outline"
            description="No model, inference endpoint, or explanation service exists."
          />
          <ResearchAvailabilityRow
            label="Select model or dataset"
            status="Read-only fixture"
            tone="outline"
            description="The fixture reference is fixed and cannot be changed."
          />
          <ResearchAvailabilityRow
            label="Export explanation"
            status="Unavailable"
            tone="outline"
            description="No export format or download endpoint exists."
          />
          <ResearchAvailabilityRow
            label="Compare explanations"
            status="Unavailable"
            tone="outline"
            description="Only one illustrative fixture is available."
          />
        </CardContent>
      </Card>

      <Alert tone="info" title="No model-behaviour claim">
        Feature importance does not establish causation, biomarker validity,
        diagnostic utility, or treatment effect. Those conclusions require
        validated data, methods, and review beyond this frontend demo.
      </Alert>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/research/datasets" variant="outline">
          <ShieldAlert aria-hidden="true" className="size-4" />
          Dataset inventory
        </ButtonLink>
        <ButtonLink href="/research/experiments" variant="outline">
          Experiment inventory
        </ButtonLink>
      </div>
    </div>
  );
}
