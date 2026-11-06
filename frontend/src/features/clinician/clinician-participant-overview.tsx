"use client";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CircleSlash2,
  Fingerprint,
  Gauge,
  History,
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
import { DEMO_PARTICIPANT_ID } from "@/data/demo/participant";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import { CptProgressCharts } from "@/features/activities/cpt/cpt-progress-charts";
import { getParticipantScoredCptRuns } from "@/features/clinician/clinician-data";
import { ClinicianParticipantNav } from "@/features/clinician/clinician-participant-nav";
import {
  ClinicianStatusBadge,
  clinicianRosterStatusConfig,
} from "@/features/clinician/clinician-status";
import { buildDigitalTwinProfile } from "@/features/digital-twin/digital-twin-profile-data";
import { formatDate, formatDateTime } from "@/lib/utils";
import type {
  ClinicianParticipant,
  CptRunSummary,
  DemoMeta,
} from "@/types";

function SummaryMetric({
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

function DetailRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-line/70 py-3 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {detail ? (
          <p className="mt-0.5 text-xs leading-5 text-ink-subtle">{detail}</p>
        ) : null}
      </div>
      <span className="shrink-0 font-mono text-xs font-medium text-ink-muted">
        {value}
      </span>
    </div>
  );
}

function AvailabilityRow({
  label,
  status,
  tone,
  description,
}: {
  label: string;
  status: string;
  tone: BadgeTone;
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
      <Badge tone={tone} className="shrink-0">
        {status}
      </Badge>
    </div>
  );
}

function RunMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function LinkedRunRow({
  run,
  linkAvailable,
}: {
  run: CptRunSummary;
  linkAvailable: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-mono text-xs font-medium text-ink">{run.id}</p>
        <p className="mt-0.5 text-xs text-ink-subtle">
          {formatDateTime(run.completedAt)} UTC
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span>
          Accuracy{" "}
          <span className="font-mono font-medium text-ink">
            {run.accuracyPercent !== null
              ? `${run.accuracyPercent}%`
              : "—"}
          </span>
        </span>
        <span>
          Mean hit RT{" "}
          <span className="font-mono font-medium text-ink">
            {run.meanHitReactionTimeMs !== null
              ? `${run.meanHitReactionTimeMs} ms`
              : "—"}
          </span>
        </span>
        {linkAvailable ? (
          <Link
            href={`/participant/activities/history/${run.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
          >
            Open run
            <ArrowRight aria-hidden="true" className="size-3" />
          </Link>
        ) : null}
      </div>
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

export function ClinicianParticipantOverview({
  participant,
  meta,
}: {
  participant: ClinicianParticipant;
  meta: DemoMeta;
}) {
  const { cptRuns } = useActivitySessions();
  const linkedRuns = getParticipantScoredCptRuns(cptRuns, participant.id);
  const profile = buildDigitalTwinProfile(linkedRuns);
  const {
    scoredRuns,
    aggregate,
    latestRun,
    completeTrialLogCount,
    trendPoints,
    hasTrend,
    baselineComparison,
    consistentTrialCount,
    observationWindow,
  } = profile;

  const hasActivityData = scoredRuns.length > 0;
  const isDemoParticipant = participant.id === DEMO_PARTICIPANT_ID;
  const activityLinkAvailable = isDemoParticipant || hasActivityData;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinician workspace"
        title="Participant overview"
        description={`Synthetic demonstration record for ${participant.displayName} (${participant.researchCode}). Review available roster context and any in-memory CPT measurements linked by participant ID.`}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning" dot>
              Synthetic participant
            </Badge>
            <ClinicianStatusBadge status={participant.status} />
            <span className="font-mono text-xs text-ink-subtle">
              {participant.researchCode} · {participant.ageBand}
            </span>
            <span className="text-xs text-ink-subtle">
              No real clinical data
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink href="/clinician/participants" variant="outline">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Participant roster
            </ButtonLink>
            {isDemoParticipant ? (
              <ButtonLink href="/participant" variant="outline">
                Participant demo
                <ArrowRight aria-hidden="true" className="size-4" />
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <DemoNotice meta={meta} />

      <ClinicianParticipantNav participantId={participant.id} />

      <Alert tone="warning" title="Synthetic participant, not a clinical record">
        This overview is a frontend demonstration. It does not represent a real
        participant, EEG measurement, clinical finding, or diagnosis. CPT values
        are descriptive calculations from in-memory activity runs linked to this
        participant ID.
      </Alert>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          icon={History}
          label="Roster sessions"
          value={String(participant.sessionCount)}
          detail="Synthetic roster summary; detailed session records are not linked."
        />
        <SummaryMetric
          icon={Activity}
          label="Last session"
          value={formatDate(participant.lastSessionAt)}
          detail="Synthetic roster timestamp."
        />
        <SummaryMetric
          icon={Gauge}
          label="Signal quality"
          value={`${participant.signalQuality}%`}
          detail="Synthetic roster summary, not a live EEG measurement."
        />
        <SummaryMetric
          icon={ListChecks}
          label="Linked CPT runs"
          value={activityLinkAvailable ? String(scoredRuns.length) : "—"}
          detail={
            activityLinkAvailable
              ? "Scored in-memory runs linked by participant ID."
              : "No activity records are linked to this participant ID."
          }
        />
      </dl>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Participant overview</CardTitle>
            <CardDescription>
              Values traceable to the synthetic clinician roster fixture.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DetailRow
              label="Pseudonymous research code"
              value={participant.researchCode}
              detail="Displayed instead of direct identifiers."
            />
            <DetailRow
              label="Age band"
              value={participant.ageBand}
              detail="Synthetic roster field."
            />
            <DetailRow
              label="Roster status"
              value={clinicianRosterStatusConfig[participant.status].label}
              detail="Synthetic review indicator, not a clinical classification."
            />
            <DetailRow
              label="Participant record ID"
              value={participant.id}
              detail="Used to link in-memory activity runs."
            />
            <DetailRow
              label="Data source"
              value="Synthetic roster"
              detail="No backend or real participant record is connected."
            />
          </CardContent>
          <CardFooter>
            <p className="text-xs text-ink-subtle">
              Participant profile editing is unavailable.
            </p>
            <Badge tone="outline">Demo</Badge>
          </CardFooter>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Session history</CardTitle>
            <CardDescription>
              Roster summary only. Session-level records are not linked to this
              clinician participant ID.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                  Session count
                </dt>
                <dd className="mt-1 font-mono text-lg font-semibold text-ink">
                  {participant.sessionCount}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                  Last session
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-ink">
                  {formatDate(participant.lastSessionAt)}
                </dd>
              </div>
            </dl>

            <div className="rounded-lg border border-dashed border-line-strong bg-slate-50/60 p-3">
              <p className="text-xs leading-5 text-ink-muted">
                Detailed session history is unavailable here because the
                frontend data model does not associate session records with
                clinician participant IDs. The participant workspace maintains
                separate demo session metadata.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-ink-subtle">
              No session analysis is performed.
            </p>
            <Badge tone="outline">Not linked</Badge>
          </CardFooter>
        </Card>
      </div>

      <section
        aria-labelledby="activity-summary-heading"
        className="space-y-3"
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="activity-summary-heading"
              className="text-sm font-semibold text-ink"
            >
              Completed cognitive activity summaries
            </h2>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Scored CPT runs linked to this participant ID and held in memory
              for the current browser session.
            </p>
          </div>
          {isDemoParticipant ? (
            <ButtonLink
              href="/participant/activities/history"
              variant="outline"
              size="sm"
            >
              Activity history
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </ButtonLink>
          ) : null}
        </div>

        {hasActivityData ? (
          <>
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryMetric
                icon={ListChecks}
                label="Scored runs"
                value={String(scoredRuns.length)}
                detail="Linked in-memory runs"
              />
              <SummaryMetric
                icon={Gauge}
                label="Aggregate accuracy"
                value={
                  aggregate.accuracyPercent !== null
                    ? `${aggregate.accuracyPercent}%`
                    : "—"
                }
                detail="Hits plus correct rejections"
              />
              <SummaryMetric
                icon={Activity}
                label="Scored trials"
                value={String(aggregate.trialCount)}
                detail="Recorded trial events"
              />
              <SummaryMetric
                icon={Target}
                label="Target detections"
                value={`${aggregate.hitCount}/${aggregate.targetCount}`}
                detail={`${aggregate.missCount} missed target${
                  aggregate.missCount === 1 ? "" : "s"
                }`}
              />
              <SummaryMetric
                icon={CircleSlash2}
                label="False alarms"
                value={String(aggregate.falseAlarmCount)}
                detail={`${aggregate.correctRejectionCount} correct rejection${
                  aggregate.correctRejectionCount === 1 ? "" : "s"
                }`}
              />
              <SummaryMetric
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

            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Recent linked runs</CardTitle>
                  <CardDescription>
                    Newest first. Metrics are recalculated from trial-level
                    events using the shared CPT scoring helper.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {scoredRuns.slice(0, 3).map((run) => (
                    <LinkedRunRow
                      key={run.id}
                      run={run}
                      linkAvailable={isDemoParticipant}
                    />
                  ))}
                </CardContent>
                <CardFooter>
                  <p className="text-xs text-ink-subtle">
                    {scoredRuns.length} linked scored run
                    {scoredRuns.length === 1 ? "" : "s"}
                  </p>
                  <Badge tone="outline">In-memory</Badge>
                </CardFooter>
              </Card>

              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle>Latest run</CardTitle>
                  <CardDescription>
                    Most recent linked scored CPT record.
                  </CardDescription>
                </CardHeader>
                {latestRun ? (
                  <>
                    <CardContent className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="brand">{latestRun.id}</Badge>
                        <span className="text-xs text-ink-subtle">
                          {formatDateTime(latestRun.completedAt)} UTC
                        </span>
                      </div>
                      <dl className="grid grid-cols-2 gap-4">
                        <RunMetric
                          label="Accuracy"
                          value={
                            latestRun.accuracyPercent !== null
                              ? `${latestRun.accuracyPercent}%`
                              : "—"
                          }
                        />
                        <RunMetric
                          label="Targets"
                          value={`${latestRun.hitCount}/${latestRun.targetCount}`}
                        />
                        <RunMetric
                          label="False alarms"
                          value={String(latestRun.falseAlarmCount)}
                        />
                        <RunMetric
                          label="Mean hit RT"
                          value={
                            latestRun.meanHitReactionTimeMs !== null
                              ? `${latestRun.meanHitReactionTimeMs} ms`
                              : "—"
                          }
                        />
                      </dl>
                    </CardContent>
                    <CardFooter>
                      <p className="text-xs text-ink-subtle">
                        {latestRun.trialCount} scored trials
                      </p>
                      {isDemoParticipant ? (
                        <ButtonLink
                          href={`/participant/activities/history/${latestRun.id}`}
                          variant="outline"
                          size="sm"
                        >
                          Open run
                          <ArrowRight
                            aria-hidden="true"
                            className="size-3.5"
                          />
                        </ButtonLink>
                      ) : null}
                    </CardFooter>
                  </>
                ) : null}
              </Card>
            </div>

            {!hasTrend ? (
              <p className="text-xs leading-5 text-ink-subtle">
                A trend chart requires at least two linked scored runs. No
                longitudinal trend is inferred from a single run.
              </p>
            ) : null}
          </>
        ) : (
          <Card>
            <CardContent className="py-6">
              <EmptyState
                icon={Activity}
                title={
                  isDemoParticipant
                    ? "No scored CPT runs in this browser session"
                    : "No activity runs linked to this participant"
                }
                description={
                  isDemoParticipant
                    ? "Complete a scored CPT run in the participant workspace to populate linked activity metrics. Practice results are not stored."
                    : "The frontend activity store only records runs for the demonstration participant. No activity results are inferred for this roster record."
                }
                action={
                  isDemoParticipant ? (
                    <ButtonLink href="/participant/activities/cpt">
                      Open the CPT
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/clinician/participants" variant="outline">
                      Back to participant roster
                    </ButtonLink>
                  )
                }
              />
            </CardContent>
          </Card>
        )}
      </section>

      {hasTrend ? (
        <section aria-labelledby="cpt-trends-heading" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2
                id="cpt-trends-heading"
                className="text-sm font-semibold text-ink"
              >
                CPT trends
              </h2>
              <p className="mt-0.5 text-xs text-ink-subtle">
                Descriptive accuracy and reaction-time series from{" "}
                {trendPoints.length} linked scored runs. No trend is shown with
                fewer than two runs.
              </p>
            </div>
            <Badge tone="outline">Descriptive only</Badge>
          </div>
          <CptProgressCharts data={trendPoints} />
        </section>
      ) : null}

      <section
        aria-labelledby="digital-twin-summary-heading"
        className="space-y-3"
      >
        <div>
          <h2
            id="digital-twin-summary-heading"
            className="text-sm font-semibold text-ink"
          >
            Digital Twin summary and measurement availability
          </h2>
          <p className="mt-0.5 text-xs text-ink-subtle">
            The research profile is descriptive and limited to linked CPT
            measurements. EEG-derived features and model outputs are not
            available.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="flex flex-col">
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Research Digital Twin</CardTitle>
                <CardDescription>
                  Descriptive summary from linked scored CPT runs.
                </CardDescription>
              </div>
              <Fingerprint
                aria-hidden="true"
                className="size-5 shrink-0 text-brand-600"
              />
            </CardHeader>

            <CardContent className="flex-1 space-y-4">
              {hasActivityData ? (
                <>
                  <dl className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                        Scored runs
                      </dt>
                      <dd className="mt-1 font-mono text-lg font-semibold text-ink">
                        {scoredRuns.length}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                        Aggregate accuracy
                      </dt>
                      <dd className="mt-1 font-mono text-lg font-semibold text-ink">
                        {aggregate.accuracyPercent !== null
                          ? `${aggregate.accuracyPercent}%`
                          : "—"}
                      </dd>
                    </div>
                  </dl>

                  {observationWindow ? (
                    <p className="text-xs leading-5 text-ink-subtle">
                      Observation window:{" "}
                      {formatDateTime(observationWindow.start)} to{" "}
                      {formatDateTime(observationWindow.end)} UTC
                    </p>
                  ) : null}

                  {baselineComparison ? (
                    <div className="rounded-lg border border-line bg-slate-50/60 p-3">
                      <p className="text-xs font-medium text-ink">
                        Latest run vs first-run reference
                      </p>
                      <p className="mt-1 text-xs leading-5 text-ink-subtle">
                        Accuracy {formatDelta(baselineComparison.accuracyDelta, "pts")} · Mean
                        hit RT{" "}
                        {formatDelta(baselineComparison.reactionTimeDelta, "ms")}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-ink-subtle">
                        Descriptive difference only; not a measure of clinical
                        improvement.
                      </p>
                    </div>
                  ) : null}

                  <p className="text-xs leading-5 text-ink-subtle">
                    This is not a trained model, brain simulation, or clinical
                    assessment.
                  </p>
                </>
              ) : (
                <EmptyState
                  icon={Fingerprint}
                  title="No Digital Twin measurements available"
                  description="A research profile is calculated only when linked scored CPT runs exist. No EEG features or model outputs are inferred."
                />
              )}
            </CardContent>

            {isDemoParticipant ? (
              <CardFooter>
                <p className="text-xs text-ink-subtle">
                  Participant-facing demo profile uses the same in-memory runs.
                </p>
                <ButtonLink
                  href="/participant/digital-twin"
                  variant="outline"
                  size="sm"
                >
                  Open profile
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </ButtonLink>
              </CardFooter>
            ) : null}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Measurement availability</CardTitle>
              <CardDescription>
                Explicit source states for this prototype.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AvailabilityRow
                label="Cognitive activity"
                status={hasActivityData ? "Available" : "Awaiting data"}
                tone={hasActivityData ? "success" : "outline"}
                description={
                  hasActivityData
                    ? `${scoredRuns.length} linked scored CPT run${
                        scoredRuns.length === 1 ? "" : "s"
                      } with trial-level events.`
                    : "No linked scored CPT runs are stored in this browser session."
                }
              />
              <AvailabilityRow
                label="EEG recordings"
                status="Demo metadata only"
                tone="warning"
                description="Upload and session interfaces exist as demo metadata. No real EEG signal is available."
              />
              <AvailabilityRow
                label="EEG-derived features"
                status="Not connected"
                tone="outline"
                description="No preprocessing, feature extraction, or signal-analysis service is connected."
              />
              <AvailabilityRow
                label="Learned Digital Twin"
                status="Not available"
                tone="outline"
                description="No trained model, inference pipeline, or learned representation exists."
              />
              <AvailabilityRow
                label="Webcam and external APIs"
                status="Not connected"
                tone="outline"
                description="No camera, hardware, or external-service integration is available."
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Data quality and missing data</CardTitle>
            <CardDescription>
              Only values traceable to the synthetic roster or linked in-memory
              CPT runs are shown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DetailRow
              label="Participant record"
              value="Synthetic roster"
              detail="No real participant or backend record."
            />
            <DetailRow
              label="Session detail linkage"
              value="Unavailable"
              detail="Only roster-level session summaries are available."
            />
            <DetailRow
              label="Activity linkage"
              value={
                activityLinkAvailable
                  ? "Linked by participant ID"
                  : "Unavailable"
              }
              detail={
                activityLinkAvailable
                  ? "Scored CPT runs are filtered by participant ID."
                  : "No activity runs are associated with this participant ID."
              }
            />
            <DetailRow
              label="Trial log completeness"
              value={
                hasActivityData
                  ? `${completeTrialLogCount}/${scoredRuns.length} complete`
                  : "No data"
              }
              detail="A run is complete when its event count matches the deterministic scored trial sequence."
            />
            <DetailRow
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
            <DetailRow
              label="EEG measurements"
              value="Unavailable"
              detail="No real EEG recording or derived measurement exists."
            />
            <DetailRow
              label="Model outputs"
              value="Unavailable"
              detail="No trained model or inference result exists."
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Participant workspace links</CardTitle>
            <CardDescription>
              Relevant participant-facing views, shown only when they use the
              same demo participant identity.
            </CardDescription>
          </CardHeader>

          {isDemoParticipant ? (
            <CardContent className="flex-1 space-y-2.5">
              <Link
                href="/participant/activities/history"
                className="flex items-center justify-between gap-3 rounded-lg border border-line p-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                <div className="flex items-center gap-2.5">
                  <ListChecks
                    aria-hidden="true"
                    className="size-4 text-brand-700"
                  />
                  <div>
                    <p className="text-sm font-medium text-ink">
                      Activity history
                    </p>
                    <p className="text-xs text-ink-subtle">
                      Review linked in-memory CPT runs.
                    </p>
                  </div>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-ink-subtle"
                />
              </Link>

              <Link
                href="/participant/progress"
                className="flex items-center justify-between gap-3 rounded-lg border border-line p-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp
                    aria-hidden="true"
                    className="size-4 text-brand-700"
                  />
                  <div>
                    <p className="text-sm font-medium text-ink">Progress</p>
                    <p className="text-xs text-ink-subtle">
                      Aggregate CPT metrics and trends.
                    </p>
                  </div>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-ink-subtle"
                />
              </Link>

              <Link
                href="/participant/digital-twin"
                className="flex items-center justify-between gap-3 rounded-lg border border-line p-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                <div className="flex items-center gap-2.5">
                  <Fingerprint
                    aria-hidden="true"
                    className="size-4 text-brand-700"
                  />
                  <div>
                    <p className="text-sm font-medium text-ink">
                      Digital Twin
                    </p>
                    <p className="text-xs text-ink-subtle">
                      Research profile and modality states.
                    </p>
                  </div>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-ink-subtle"
                />
              </Link>
            </CardContent>
          ) : (
            <CardContent className="flex-1">
              <EmptyState
                icon={CircleSlash2}
                title="Participant workspace links unavailable"
                description="The participant-facing activity, progress, and Digital Twin routes are currently tied to the demo participant. They are not shown here to avoid displaying another participant's data."
                action={
                  <ButtonLink href="/clinician/participants" variant="outline">
                    Back to participant roster
                  </ButtonLink>
                }
              />
            </CardContent>
          )}

          <CardFooter>
            <p className="text-xs text-ink-subtle">
              No production authorization is implemented.
            </p>
            <Badge tone="outline">Demo</Badge>
          </CardFooter>
        </Card>
      </div>

      <Alert tone="info" title="In-memory activity data resets">
        Linked CPT runs are held only in memory for the current browser session.
        Reloading the browser or clearing activity history removes them. No EEG
        signal, derived EEG feature, model output, or clinical assessment is
        present.
      </Alert>
    </div>
  );
}
