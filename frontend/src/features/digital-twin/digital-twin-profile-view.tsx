"use client";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Camera,
  CircleSlash2,
  Cpu,
  Database,
  Fingerprint,
  Gauge,
  ListChecks,
  Target,
  Timer,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
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
  demoParticipant,
  participantDemoMeta,
} from "@/data/demo/participant";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import { CptProgressCharts } from "@/features/activities/cpt/cpt-progress-charts";
import { buildDigitalTwinProfile } from "@/features/digital-twin/digital-twin-profile-data";
import { formatDateTime } from "@/lib/utils";

function ProfileMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="p-5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <Icon aria-hidden="true" className="size-[18px]" />
      </span>
      <dt className="mt-4 text-xs font-medium text-ink-subtle">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-semibold tracking-tight text-ink">
        {value}
      </dd>
      <dd className="mt-1 text-xs leading-5 text-ink-subtle">{detail}</dd>
    </Card>
  );
}

function CoverageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg font-semibold text-ink">{value}</dd>
    </div>
  );
}

function BaselineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function ModalityCard({
  icon: Icon,
  title,
  status,
  tone,
  description,
}: {
  icon: LucideIcon;
  title: string;
  status: string;
  tone: BadgeTone;
  description: string;
}) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-ink-muted">
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
        <Badge tone={tone}>{status}</Badge>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-ink-subtle">{description}</p>
    </Card>
  );
}

function DataQualityRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-line/70 py-3 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-ink-subtle">{detail}</p>
      </div>
      <span className="shrink-0 font-mono text-xs font-medium text-ink-muted">
        {value}
      </span>
    </div>
  );
}

function ConfigurationRow({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-line/70 py-3 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-ink-subtle">
          {description}
        </p>
      </div>
      <Badge tone="outline" className="shrink-0">
        Unavailable
      </Badge>
    </div>
  );
}

function formatDelta(value: number | null, unit: string): string {
  if (value === null) {
    return "—";
  }

  if (value === 0) {
    return `0 ${unit}`;
  }

  return `${value > 0 ? "+" : ""}${value} ${unit}`;
}

export function DigitalTwinProfileView() {
  const { cptRuns } = useActivitySessions();
  const profile = buildDigitalTwinProfile(cptRuns);
  const {
    scoredRuns,
    aggregate,
    latestRun,
    baselineRun,
    completeTrialLogCount,
    trendPoints,
    hasTrend,
    baselineComparison,
    consistentTrialCount,
    observationWindow,
  } = profile;

  const hasActivityData = scoredRuns.length > 0;
  const lastUpdated = latestRun?.completedAt ?? null;

  const modalities: Array<{
    id: string;
    icon: LucideIcon;
    title: string;
    status: string;
    tone: BadgeTone;
    description: string;
  }> = [
    {
      id: "cognitive-activity",
      icon: BrainCircuit,
      title: "Cognitive activity",
      status: hasActivityData ? "Available" : "Awaiting data",
      tone: hasActivityData ? "success" : "outline",
      description: hasActivityData
        ? `${scoredRuns.length} scored CPT run${
            scoredRuns.length === 1 ? "" : "s"
          } with trial-level events and calculated metrics.`
        : "No scored CPT runs are stored in this browser session yet.",
    },
    {
      id: "eeg-recordings",
      icon: Activity,
      title: "EEG recordings",
      status: "Demo metadata only",
      tone: "warning",
      description:
        "Upload and session-record interfaces exist as demo metadata. No real EEG signal, quality analysis, or derived features are available.",
    },
    {
      id: "eeg-features",
      icon: Database,
      title: "EEG-derived features",
      status: "Not connected",
      tone: "outline",
      description:
        "No preprocessing, feature extraction, or signal-analysis service is connected.",
    },
    {
      id: "learned-model",
      icon: Cpu,
      title: "Learned Digital Twin",
      status: "Not available",
      tone: "outline",
      description:
        "No trained model, inference pipeline, or learned representation of the participant exists.",
    },
    {
      id: "external-modalities",
      icon: Camera,
      title: "Webcam and external APIs",
      status: "Not connected",
      tone: "outline",
      description:
        "No camera, hardware, or external-service integration is available.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Digital Twin"
        description="A research profile that summarizes cognitive activity measurements recorded in this browser session. It is not a brain simulation, a trained model, or a clinical assessment."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent" dot>
              Research profile
            </Badge>
            <Badge tone="brand">In-memory</Badge>
            <span className="font-mono text-xs text-ink-subtle">
              {demoParticipant.researchCode} · demo participant
            </span>
            {lastUpdated ? (
              <span className="text-xs text-ink-subtle">
                Last activity update {formatDateTime(lastUpdated)} UTC
              </span>
            ) : (
              <span className="text-xs text-ink-subtle">
                No activity timestamp yet
              </span>
            )}
          </div>
        }
        actions={
          <>
            <ButtonLink
              href="/participant/activities/history"
              variant="outline"
            >
              <ListChecks aria-hidden="true" className="size-4" />
              Activity history
            </ButtonLink>
            <ButtonLink href="/participant/progress" variant="outline">
              <TrendingUp aria-hidden="true" className="size-4" />
              Progress
            </ButtonLink>
            <ButtonLink href="/participant" variant="outline">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to overview
            </ButtonLink>
          </>
        }
      />

      <DemoNotice meta={participantDemoMeta} />

      <Alert tone="warning" title="Research profile, not a clinical model">
        This page summarizes recorded CPT measurements and descriptive
        calculations. It does not use EEG-derived features, a trained model, or
        a learned representation of the participant, and it does not diagnose
        ADHD.
      </Alert>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="flex flex-col">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Profile overview</CardTitle>
              <CardDescription>
                What this research profile contains and what it does not.
              </CardDescription>
            </div>
            <Fingerprint
              aria-hidden="true"
              className="size-5 shrink-0 text-brand-600"
            />
          </CardHeader>

          <CardContent className="flex-1 space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-line bg-slate-50/70 p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
                {demoParticipant.initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {demoParticipant.displayName}
                </p>
                <p className="truncate font-mono text-[11px] text-ink-subtle">
                  {demoParticipant.researchCode} · synthetic demo participant
                </p>
              </div>
            </div>

            <ul className="space-y-2 text-sm leading-6 text-ink-muted">
              <li>
                Summarizes scored CPT runs recorded in this browser session.
              </li>
              <li>
                Recalculates metrics from trial-level events using the existing
                CPT scoring rules.
              </li>
              <li>
                Excludes EEG-derived features, model inference, and any learned
                representation of the brain.
              </li>
              <li>
                Resets when the browser reloads or activity history is cleared.
              </li>
            </ul>
          </CardContent>

          <CardFooter>
            <p className="text-xs text-ink-subtle">
              Profile editing is unavailable in this prototype.
            </p>
            <Badge tone="outline">Demo</Badge>
          </CardFooter>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Observation coverage</CardTitle>
            <CardDescription>
              Counts from scored CPT records currently held in memory.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 space-y-4">
            <dl className="grid grid-cols-2 gap-4">
              <CoverageMetric
                label="Scored runs"
                value={String(scoredRuns.length)}
              />
              <CoverageMetric
                label="Comparable sessions"
                value={String(scoredRuns.length)}
              />
              <CoverageMetric
                label="Recorded trial events"
                value={String(aggregate.trialCount)}
              />
              <CoverageMetric
                label="Complete trial logs"
                value={
                  hasActivityData
                    ? `${completeTrialLogCount}/${scoredRuns.length}`
                    : "0"
                }
              />
            </dl>

            {observationWindow ? (
              <p className="text-xs leading-5 text-ink-subtle">
                Observation window:{" "}
                {formatDateTime(observationWindow.start)} to{" "}
                {formatDateTime(observationWindow.end)} UTC
              </p>
            ) : (
              <p className="text-xs leading-5 text-ink-subtle">
                No observation window is available until a scored run is
                recorded.
              </p>
            )}
          </CardContent>

          <CardFooter className="flex-wrap">
            <p className="text-xs text-ink-subtle">
              {lastUpdated
                ? `Last updated ${formatDateTime(lastUpdated)} UTC`
                : "No activity timestamp available"}
            </p>
            {latestRun ? (
              <ButtonLink
                href={`/participant/activities/history/${latestRun.id}`}
                variant="outline"
                size="sm"
              >
                Open latest run
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </ButtonLink>
            ) : null}
          </CardFooter>
        </Card>
      </div>

      <section aria-labelledby="twin-metrics-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="twin-metrics-heading"
              className="text-sm font-semibold text-ink"
            >
              Activity measurement summary
            </h2>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Calculated from {scoredRuns.length} scored run
              {scoredRuns.length === 1 ? "" : "s"} and{" "}
              {aggregate.trialCount} recorded trial events.
            </p>
          </div>
          <Badge tone="outline">Descriptive only</Badge>
        </div>

        {hasActivityData ? (
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ProfileMetric
              icon={Gauge}
              label="Aggregate accuracy"
              value={
                aggregate.accuracyPercent !== null
                  ? `${aggregate.accuracyPercent}%`
                  : "—"
              }
              detail="Hits plus correct rejections"
            />
            <ProfileMetric
              icon={ListChecks}
              label="Scored trials"
              value={String(aggregate.trialCount)}
              detail="Recorded trial events"
            />
            <ProfileMetric
              icon={Activity}
              label="Responses"
              value={String(aggregate.responseCount)}
              detail="Trials with a response"
            />
            <ProfileMetric
              icon={Target}
              label="Target detections"
              value={`${aggregate.hitCount}/${aggregate.targetCount}`}
              detail={`${aggregate.missCount} missed target${
                aggregate.missCount === 1 ? "" : "s"
              }`}
            />
            <ProfileMetric
              icon={CircleSlash2}
              label="False alarms"
              value={String(aggregate.falseAlarmCount)}
              detail={`${aggregate.correctRejectionCount} correct rejection${
                aggregate.correctRejectionCount === 1 ? "" : "s"
              }`}
            />
            <ProfileMetric
              icon={Timer}
              label="Mean hit RT"
              value={
                aggregate.meanHitReactionTimeMs !== null
                  ? `${aggregate.meanHitReactionTimeMs} ms`
                  : "—"
              }
              detail={`${aggregate.validReactionTimeCount} valid detection${
                aggregate.validReactionTimeCount === 1 ? "" : "s"
              }`}
            />
          </dl>
        ) : (
          <Card>
            <CardContent className="py-6">
              <EmptyState
                icon={Activity}
                title="No activity measurements yet"
                description="Complete a scored CPT run to populate this research profile. The profile does not invent measurements when data is missing."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <ButtonLink href="/participant/activities/cpt">
                      Try the CPT
                    </ButtonLink>
                    <ButtonLink
                      href="/participant/activities/history"
                      variant="outline"
                    >
                      Activity history
                    </ButtonLink>
                  </div>
                }
              />
            </CardContent>
          </Card>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Demo baseline reference</CardTitle>
            <CardDescription>
              The earliest scored run in the current in-memory history.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 space-y-4">
            {baselineRun ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="outline">{baselineRun.id}</Badge>
                  <span className="text-xs text-ink-subtle">
                    {formatDateTime(baselineRun.completedAt)} UTC
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-4">
                  <BaselineMetric
                    label="Accuracy"
                    value={
                      baselineRun.accuracyPercent !== null
                        ? `${baselineRun.accuracyPercent}%`
                        : "—"
                    }
                  />
                  <BaselineMetric
                    label="Mean hit RT"
                    value={
                      baselineRun.meanHitReactionTimeMs !== null
                        ? `${baselineRun.meanHitReactionTimeMs} ms`
                        : "—"
                    }
                  />
                  <BaselineMetric
                    label="Trials"
                    value={String(baselineRun.trialCount)}
                  />
                  <BaselineMetric
                    label="Targets detected"
                    value={`${baselineRun.hitCount}/${baselineRun.targetCount}`}
                  />
                </dl>

                <p className="text-xs leading-5 text-ink-subtle">
                  Method: the earliest scored CPT run in the current in-memory
                  history is used as a fixed reference. This is a demo
                  convention, not a clinical baseline; clearing history or
                  evicting older runs changes it.
                </p>

                {baselineComparison ? (
                  <div className="rounded-lg border border-line bg-slate-50/60 p-3">
                    <p className="text-xs font-medium text-ink">
                      Latest run vs first-run reference
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-3">
                      <BaselineMetric
                        label="Accuracy difference"
                        value={formatDelta(
                          baselineComparison.accuracyDelta,
                          "pts",
                        )}
                      />
                      <BaselineMetric
                        label="Mean hit RT difference"
                        value={formatDelta(
                          baselineComparison.reactionTimeDelta,
                          "ms",
                        )}
                      />
                    </dl>
                    <p className="mt-2 text-xs leading-5 text-ink-subtle">
                      Descriptive difference only; not a measure of improvement
                      or clinical change.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs leading-5 text-ink-subtle">
                    At least two scored runs are required to compare the latest
                    run with the first-run reference.
                  </p>
                )}
              </>
            ) : (
              <EmptyState
                icon={CircleSlash2}
                title="No baseline available"
                description="A baseline reference is created only after a scored CPT run is recorded."
                action={
                  <ButtonLink
                    href="/participant/activities/cpt"
                    size="sm"
                  >
                    Try the CPT
                  </ButtonLink>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Recorded, calculated, interpreted</CardTitle>
            <CardDescription>
              How to read the values on this page.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 space-y-4 text-sm leading-6 text-ink-muted">
            <div>
              <p className="font-medium text-ink">Recorded events</p>
              <p>
                Each scored CPT trial records the stimulus, response, reaction
                time, and outcome.
              </p>
            </div>
            <div>
              <p className="font-medium text-ink">Calculated summaries</p>
              <p>
                Accuracy, counts, and mean hit reaction time are derived from
                those events using the existing CPT scoring logic.
              </p>
            </div>
            <div>
              <p className="font-medium text-ink">Experimental interpretations</p>
              <p>
                Trends and first-run differences are descriptive. They are not
                diagnostic, predictive, or evidence of clinical improvement.
              </p>
            </div>
          </CardContent>

          <CardFooter>
            <Link
              href="/participant/activities/history"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
            >
              Review raw trial events
              <ArrowRight aria-hidden="true" className="size-3" />
            </Link>
          </CardFooter>
        </Card>
      </div>

      <section aria-labelledby="twin-trends-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="twin-trends-heading"
              className="text-sm font-semibold text-ink"
            >
              Activity trends
            </h2>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Reuses the progress calculations. Charts appear only when at least
              two comparable scored runs exist.
            </p>
          </div>
          <span className="text-xs text-ink-subtle">
            {hasTrend
              ? `${trendPoints.length} runs compared`
              : "Not enough runs for a trend"}
          </span>
        </div>

        {hasTrend ? (
          <CptProgressCharts data={trendPoints} />
        ) : (
          <Card>
            <CardContent className="py-6">
              <EmptyState
                icon={TrendingUp}
                title={
                  hasActivityData
                    ? "A trend needs at least two scored runs"
                    : "No trend data yet"
                }
                description={
                  hasActivityData
                    ? "One scored run is recorded. Complete another comparable scored run to compare accuracy and reaction time."
                    : "Complete at least two scored CPT runs to populate activity trends. No chart is shown without sufficient observations."
                }
                action={
                  <ButtonLink
                    href="/participant/activities/cpt"
                    size="sm"
                  >
                    {hasActivityData ? "Run the CPT again" : "Try the CPT"}
                  </ButtonLink>
                }
              />
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-labelledby="twin-modalities-heading" className="space-y-3">
        <div>
          <h2
            id="twin-modalities-heading"
            className="text-sm font-semibold text-ink"
          >
            Data sources and modalities
          </h2>
          <p className="mt-0.5 text-xs text-ink-subtle">
            Only cognitive activity measurements contribute to this profile in
            the current prototype.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modalities.map((modality) => (
            <ModalityCard
              key={modality.id}
              icon={modality.icon}
              title={modality.title}
              status={modality.status}
              tone={modality.tone}
              description={modality.description}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Data quality</CardTitle>
            <CardDescription>
              Checks limited to the CPT records available in memory.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <DataQualityRow
              label="Trial log completeness"
              value={
                hasActivityData
                  ? `${completeTrialLogCount}/${scoredRuns.length} complete`
                  : "No data"
              }
              detail="A run is complete when its event count matches the deterministic scored trial sequence."
            />
            <DataQualityRow
              label="Reaction-time observations"
              value={`${aggregate.validReactionTimeCount} valid hit timings`}
              detail="Only correct detections with valid timestamps contribute."
            />
            <DataQualityRow
              label="Comparable trial counts"
              value={
                hasActivityData
                  ? consistentTrialCount
                    ? "Consistent"
                    : "Mixed"
                  : "No data"
              }
              detail="Scored runs are comparable when they share the same trial count."
            />
            <DataQualityRow
              label="Persistence"
              value="In-memory only"
              detail="No browser storage or backend synchronization."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile configuration</CardTitle>
            <CardDescription>
              Unsupported controls are shown as unavailable rather than as
              inactive buttons.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <ConfigurationRow
              label="Profile editing"
              description="No edit or save workflow is connected."
            />
            <ConfigurationRow
              label="Baseline selection"
              description="The first scored run is used as a fixed demo reference."
            />
            <ConfigurationRow
              label="Data export"
              description="No export or report endpoint is connected."
            />
            <ConfigurationRow
              label="External synchronization"
              description="No account, backend, or device sync is available."
            />
          </CardContent>
        </Card>
      </div>

      <Alert tone="info" title="Demo data resets">
        This Digital Twin profile is calculated only from in-memory activity
        records. Reloading the browser or clearing activity history removes the
        underlying data and changes the profile. No EEG signal, derived EEG
        feature, model output, or clinical assessment is present.
      </Alert>
    </div>
  );
}
