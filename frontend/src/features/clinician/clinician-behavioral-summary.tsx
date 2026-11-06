"use client";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CircleSlash2,
  Gauge,
  ListChecks,
  Target,
  Timer,
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
import { EmptyState } from "@/components/ui/empty-state";
import { DEMO_PARTICIPANT_ID } from "@/data/demo/participant";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import {
  CPT_RESPONSE_WINDOW_MS,
  CPT_SCORED_TRIALS,
  CPT_STIMULUS_DURATION_MS,
  CPT_TARGET_STIMULUS,
} from "@/features/activities/cpt/cpt-config";
import { CptProgressCharts } from "@/features/activities/cpt/cpt-progress-charts";
import { getParticipantScoredCptRuns } from "@/features/clinician/clinician-data";
import { ClinicianDetailRow } from "@/features/clinician/clinician-rows";
import { ClinicianMetricCard } from "@/features/clinician/clinician-metric-card";
import { ClinicianParticipantNav } from "@/features/clinician/clinician-participant-nav";
import { buildDigitalTwinProfile } from "@/features/digital-twin/digital-twin-profile-data";
import { formatDateTime } from "@/lib/utils";
import type { ClinicianParticipant, CptRunSummary, DemoMeta } from "@/types";

function formatDelta(value: number | null, unit: string): string {
  if (value === null) {
    return "—";
  }

  if (value === 0) {
    return `0 ${unit}`;
  }

  return `${value > 0 ? "+" : ""}${value} ${unit}`;
}

function RunRow({
  run,
  linkAvailable,
}: {
  run: CptRunSummary;
  linkAvailable: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs font-medium text-ink">{run.id}</p>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {formatDateTime(run.completedAt)} UTC
          </p>
        </div>
        <Badge tone={run.events.length === run.trialCount ? "success" : "warning"}>
          {run.events.length === run.trialCount ? "Complete log" : "Partial log"}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
            Accuracy
          </dt>
          <dd className="mt-0.5 font-mono text-sm font-semibold text-ink">
            {run.accuracyPercent !== null ? `${run.accuracyPercent}%` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
            Targets
          </dt>
          <dd className="mt-0.5 font-mono text-sm font-semibold text-ink">
            {run.hitCount}/{run.targetCount}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
            False alarms
          </dt>
          <dd className="mt-0.5 font-mono text-sm font-semibold text-ink">
            {run.falseAlarmCount}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
            Mean hit RT
          </dt>
          <dd className="mt-0.5 font-mono text-sm font-semibold text-ink">
            {run.meanHitReactionTimeMs !== null
              ? `${run.meanHitReactionTimeMs} ms`
              : "—"}
          </dd>
        </div>
      </dl>

      {linkAvailable ? (
        <Link
          href={`/participant/activities/history/${run.id}`}
          className="inline-flex items-center gap-1 self-start text-xs font-medium text-brand-800 hover:text-brand-600"
        >
          Open run detail
          <ArrowRight aria-hidden="true" className="size-3" />
        </Link>
      ) : null}
    </div>
  );
}

export function ClinicianBehavioralSummary({
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
    completeTrialLogCount,
    trendPoints,
    hasTrend,
    baselineComparison,
    consistentTrialCount,
    observationWindow,
  } = profile;

  const hasActivityData = scoredRuns.length > 0;
  const isDemoParticipant = participant.id === DEMO_PARTICIPANT_ID;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinician workspace"
        title="Behavioral activity summary"
        description={`Descriptive CPT measurements for ${participant.displayName} (${participant.researchCode}). Values are recalculated from linked in-memory trial events and are not clinical findings.`}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning" dot>
              Synthetic participant
            </Badge>
            <span className="font-mono text-xs text-ink-subtle">
              {participant.researchCode} · {participant.ageBand}
            </span>
            <span className="text-xs text-ink-subtle">
              Descriptive activity metrics
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink
              href={`/clinician/participants/${participant.id}`}
              variant="outline"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Participant overview
            </ButtonLink>
            <ButtonLink
              href={`/clinician/participants/${participant.id}/eeg`}
              variant="outline"
            >
              EEG availability
              <ArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </>
        }
      />

      <DemoNotice meta={meta} />

      <ClinicianParticipantNav participantId={participant.id} />

      <Alert tone="warning" title="Descriptive activity data only">
        These summaries describe recorded CPT behavior in this browser session.
        They do not establish attention-deficit/hyperactivity disorder, severity,
        impairment, treatment response, or any other clinical conclusion.
      </Alert>

      {hasActivityData ? (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ClinicianMetricCard
              icon={ListChecks}
              label="Scored runs"
              value={String(scoredRuns.length)}
              detail="Linked in-memory CPT runs."
            />
            <ClinicianMetricCard
              icon={Gauge}
              label="Aggregate accuracy"
              value={
                aggregate.accuracyPercent !== null
                  ? `${aggregate.accuracyPercent}%`
                  : "—"
              }
              detail="Correct detections plus correct rejections."
            />
            <ClinicianMetricCard
              icon={Target}
              label="Target detections"
              value={`${aggregate.hitCount}/${aggregate.targetCount}`}
              detail={`${aggregate.missCount} missed target${
                aggregate.missCount === 1 ? "" : "s"
              }.`}
            />
            <ClinicianMetricCard
              icon={Timer}
              label="Mean hit RT"
              value={
                aggregate.meanHitReactionTimeMs !== null
                  ? `${aggregate.meanHitReactionTimeMs} ms`
                  : "—"
              }
              detail={`${aggregate.validReactionTimeCount} valid detection${
                aggregate.validReactionTimeCount === 1 ? "" : "s"
              }.`}
            />
            <ClinicianMetricCard
              icon={CircleSlash2}
              label="False alarms"
              value={String(aggregate.falseAlarmCount)}
              detail={`${aggregate.correctRejectionCount} correct rejection${
                aggregate.correctRejectionCount === 1 ? "" : "s"
              }.`}
            />
            <ClinicianMetricCard
              icon={Activity}
              label="Scored trials"
              value={String(aggregate.trialCount)}
              detail="Recorded trial events across linked runs."
            />
            <ClinicianMetricCard
              icon={ListChecks}
              label="Recorded responses"
              value={String(aggregate.responseCount)}
              detail="Responses recorded during scored trials."
            />
            <ClinicianMetricCard
              icon={Gauge}
              label="Complete trial logs"
              value={`${completeTrialLogCount}/${scoredRuns.length}`}
              detail="Runs whose event count matches the scored sequence."
            />
          </dl>

          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Linked CPT runs</CardTitle>
                <CardDescription>
                  Newest first. Practice attempts are excluded from this
                  summary.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {scoredRuns.map((run) => (
                  <RunRow
                    key={run.id}
                    run={run}
                    linkAvailable={isDemoParticipant}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Task configuration</CardTitle>
                <CardDescription>
                  Deterministic CPT parameters used by the shared scorer.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ClinicianDetailRow
                  label="Target stimulus"
                  value={CPT_TARGET_STIMULUS}
                  detail="The participant responds when this stimulus appears."
                />
                <ClinicianDetailRow
                  label="Scored trials"
                  value={String(CPT_SCORED_TRIALS.length)}
                  detail="Fixed sequence used for scored runs."
                />
                <ClinicianDetailRow
                  label="Stimulus duration"
                  value={`${CPT_STIMULUS_DURATION_MS} ms`}
                  detail="Duration each stimulus is displayed."
                />
                <ClinicianDetailRow
                  label="Response window"
                  value={`${CPT_RESPONSE_WINDOW_MS} ms`}
                  detail="Maximum time allowed for a response."
                />
                <ClinicianDetailRow
                  label="Practice storage"
                  value="Excluded"
                  detail="Practice attempts are not stored as scored results."
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Data completeness</CardTitle>
                <CardDescription>
                  Linkage and completeness states for the current session.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ClinicianDetailRow
                  label="Participant linkage"
                  value="Linked by participant ID"
                  detail="Runs are filtered by the participant record ID."
                />
                <ClinicianDetailRow
                  label="Complete trial logs"
                  value={`${completeTrialLogCount}/${scoredRuns.length}`}
                  detail="A complete log has one event per scored trial."
                />
                <ClinicianDetailRow
                  label="Comparable trial counts"
                  value={consistentTrialCount ? "Consistent" : "Mixed"}
                  detail="Runs are directly comparable only when trial counts match."
                />
                <ClinicianDetailRow
                  label="Observation window"
                  value={
                    observationWindow
                      ? `${formatDateTime(observationWindow.start)} – ${formatDateTime(
                          observationWindow.end,
                        )} UTC`
                      : "—"
                  }
                  detail="Earliest to latest linked scored run."
                />
                <ClinicianDetailRow
                  label="EEG linkage"
                  value="Unavailable"
                  detail="No EEG recording or derived feature is linked."
                />
                <ClinicianDetailRow
                  label="Model inference"
                  value="Unavailable"
                  detail="No trained model or prediction exists."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Latest run vs first-run reference</CardTitle>
                <CardDescription>
                  Descriptive differences from linked scored runs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {baselineComparison ? (
                  <>
                    <dl className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                          Accuracy difference
                        </dt>
                        <dd className="mt-1 font-mono text-lg font-semibold text-ink">
                          {formatDelta(baselineComparison.accuracyDelta, "pts")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                          Mean hit RT difference
                        </dt>
                        <dd className="mt-1 font-mono text-lg font-semibold text-ink">
                          {formatDelta(
                            baselineComparison.reactionTimeDelta,
                            "ms",
                          )}
                        </dd>
                      </div>
                    </dl>
                    <p className="text-xs leading-5 text-ink-subtle">
                      Positive accuracy means the latest run had a higher
                      percentage. Positive reaction-time difference means the
                      latest run was slower. This is not evidence of clinical
                      improvement or decline.
                    </p>
                  </>
                ) : (
                  <p className="text-sm leading-6 text-ink-muted">
                    A comparison requires at least two linked scored runs with
                    the relevant values. No difference is inferred from a single
                    run.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {hasTrend ? (
            <section aria-labelledby="behavior-trends-heading" className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2
                    id="behavior-trends-heading"
                    className="text-sm font-semibold text-ink"
                  >
                    Descriptive trends
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-subtle">
                    Accuracy and mean hit reaction time across{" "}
                    {trendPoints.length} linked scored runs.
                  </p>
                </div>
                <Badge tone="outline">No clinical interpretation</Badge>
              </div>
              <CptProgressCharts data={trendPoints} />
            </section>
          ) : (
            <Alert tone="info" title="Trend unavailable">
              At least two linked scored runs are required before a trend is
              displayed. A single run is not treated as a longitudinal pattern.
            </Alert>
          )}
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
                  ? "Complete a scored CPT run in the participant workspace to populate behavioral summaries. Practice attempts are not stored."
                  : "The frontend activity store only records runs for the demonstration participant. No behavioral values are inferred for this roster record."
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

      <Alert tone="info" title="In-memory data resets">
        Linked CPT runs exist only for the current browser session. Reloading or
        clearing activity history removes them. No EEG, model, or clinical
        assessment is connected.
      </Alert>
    </div>
  );
}
