"use client";

import { Activity, ArrowLeft, ArrowRight, Printer } from "lucide-react";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DEMO_PARTICIPANT_ID } from "@/data/demo/participant";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import { getParticipantScoredCptRuns } from "@/features/clinician/clinician-data";
import { ClinicianDetailRow } from "@/features/clinician/clinician-rows";
import { ClinicianParticipantNav } from "@/features/clinician/clinician-participant-nav";
import { clinicianRosterStatusConfig } from "@/features/clinician/clinician-status";
import { buildDigitalTwinProfile } from "@/features/digital-twin/digital-twin-profile-data";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ClinicianParticipant, DemoMeta } from "@/types";

function formatDelta(value: number | null, unit: string): string {
  if (value === null) {
    return "—";
  }

  if (value === 0) {
    return `0 ${unit}`;
  }

  return `${value > 0 ? "+" : ""}${value} ${unit}`;
}

function ReportMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-slate-50/60 p-3.5 print:bg-white">
      <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg font-semibold text-ink">{value}</dd>
      <dd className="mt-1 text-xs leading-5 text-ink-subtle">{detail}</dd>
    </div>
  );
}

export function ClinicianResearchReport({
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

  return (
    <div className="space-y-6">
      <PageHeader
        className="print:hidden"
        eyebrow="Clinician workspace"
        title="Research report"
        description={`A browser-printable research summary for ${participant.displayName} (${participant.researchCode}). This report contains only synthetic roster context and descriptive CPT values available in the current browser session.`}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning" dot>
              Synthetic participant
            </Badge>
            <span className="font-mono text-xs text-ink-subtle">
              {participant.researchCode} · {participant.ageBand}
            </span>
            <span className="text-xs text-ink-subtle">
              Research summary, not a clinical report
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink
              href={`/clinician/participants/${participant.id}`}
              variant="outline"
              className="print:hidden"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Participant overview
            </ButtonLink>
            <Button
              variant="outline"
              className="print:hidden"
              onClick={() => window.print()}
            >
              <Printer aria-hidden="true" className="size-4" />
              Print report
            </Button>
          </>
        }
      />

      <DemoNotice meta={meta} className="print:hidden" />

      <ClinicianParticipantNav participantId={participant.id} />

      <Alert
        tone="warning"
        title="Research demonstration only"
        className="print:hidden"
      >
        This report is not a medical record, diagnostic report, treatment plan,
        or clinical recommendation. It must not be used for care decisions.
      </Alert>

      <article className="space-y-6 rounded-xl border border-line bg-surface p-6 shadow-card print:space-y-4 print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-line pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
            Research report
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {participant.displayName}
          </h2>
          <p className="mt-1 font-mono text-xs text-ink-subtle">
            {participant.researchCode} · {participant.ageBand}
          </p>
          <p className="mt-3 max-w-2xl text-xs leading-5 text-ink-subtle">
            Prepared from the current in-memory browser session. No report
            generation timestamp is recorded, and no server-side report record
            exists.
          </p>
        </header>

        <section aria-labelledby="report-participant-heading" className="space-y-3">
          <h3
            id="report-participant-heading"
            className="text-sm font-semibold text-ink"
          >
            Participant and data source
          </h3>
          <div className="grid gap-x-8 md:grid-cols-2">
            <ClinicianDetailRow
              label="Participant record"
              value="Synthetic roster"
              detail="No real participant or backend record."
            />
            <ClinicianDetailRow
              label="Roster status"
              value={clinicianRosterStatusConfig[participant.status].label}
              detail="Synthetic review indicator, not a clinical classification."
            />
            <ClinicianDetailRow
              label="Roster sessions"
              value={String(participant.sessionCount)}
              detail="Synthetic roster summary; session records are not linked."
            />
            <ClinicianDetailRow
              label="Last roster session"
              value={formatDate(participant.lastSessionAt)}
              detail="Synthetic roster timestamp."
            />
            <ClinicianDetailRow
              label="Activity linkage"
              value={
                hasActivityData
                  ? "Linked by participant ID"
                  : "No linked runs"
              }
              detail="Scored CPT runs are filtered by participant ID."
            />
            <ClinicianDetailRow
              label="EEG linkage"
              value="Unavailable"
              detail="No EEG recording is associated with this participant."
            />
          </div>
        </section>

        <section aria-labelledby="report-cpt-heading" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h3
              id="report-cpt-heading"
              className="text-sm font-semibold text-ink"
            >
              CPT measurement summary
            </h3>
            <Badge tone="outline">Descriptive only</Badge>
          </div>

          {hasActivityData ? (
            <>
              <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ReportMetric
                  label="Scored runs"
                  value={String(scoredRuns.length)}
                  detail="Linked in-memory CPT runs."
                />
                <ReportMetric
                  label="Aggregate accuracy"
                  value={
                    aggregate.accuracyPercent !== null
                      ? `${aggregate.accuracyPercent}%`
                      : "—"
                  }
                  detail="Correct detections plus correct rejections."
                />
                <ReportMetric
                  label="Target detections"
                  value={`${aggregate.hitCount}/${aggregate.targetCount}`}
                  detail={`${aggregate.missCount} missed target${
                    aggregate.missCount === 1 ? "" : "s"
                  }.`}
                />
                <ReportMetric
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
                <ReportMetric
                  label="False alarms"
                  value={String(aggregate.falseAlarmCount)}
                  detail={`${aggregate.correctRejectionCount} correct rejection${
                    aggregate.correctRejectionCount === 1 ? "" : "s"
                  }.`}
                />
                <ReportMetric
                  label="Scored trials"
                  value={String(aggregate.trialCount)}
                  detail="Recorded trial events."
                />
                <ReportMetric
                  label="Recorded responses"
                  value={String(aggregate.responseCount)}
                  detail="Responses during scored trials."
                />
                <ReportMetric
                  label="Complete trial logs"
                  value={`${completeTrialLogCount}/${scoredRuns.length}`}
                  detail="Event count matches the scored sequence."
                />
              </dl>

              <div className="grid gap-x-8 md:grid-cols-2">
                <ClinicianDetailRow
                  label="Latest run"
                  value={latestRun ? latestRun.id : "—"}
                  detail={
                    latestRun
                      ? `${formatDateTime(latestRun.completedAt)} UTC`
                      : "No scored run."
                  }
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
                  label="Comparable trial counts"
                  value={consistentTrialCount ? "Consistent" : "Mixed"}
                  detail="Direct comparison requires matching trial counts."
                />
                <ClinicianDetailRow
                  label="Trend availability"
                  value={hasTrend ? "Available" : "Insufficient data"}
                  detail="At least two linked scored runs are required."
                />
              </div>

              {hasTrend ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                    <caption className="sr-only">
                      Descriptive CPT trend data by scored run
                    </caption>
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-subtle">
                        <th scope="col" className="py-2.5 pr-4 font-medium">
                          Run
                        </th>
                        <th scope="col" className="py-2.5 pr-4 font-medium">
                          Completed
                        </th>
                        <th scope="col" className="py-2.5 pr-4 font-medium">
                          Accuracy
                        </th>
                        <th scope="col" className="py-2.5 font-medium">
                          Mean hit RT
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendPoints.map((point) => (
                        <tr
                          key={point.runId}
                          className="border-b border-line/70 last:border-0"
                        >
                          <th
                            scope="row"
                            className="py-2.5 pr-4 font-mono text-xs font-medium text-ink"
                          >
                            {point.label} · {point.runId}
                          </th>
                          <td className="py-2.5 pr-4 text-xs text-ink-muted">
                            {formatDate(point.completedAt)}
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-xs text-ink-muted">
                            {point.accuracyPercent !== null
                              ? `${point.accuracyPercent}%`
                              : "—"}
                          </td>
                          <td className="py-2.5 font-mono text-xs text-ink-muted">
                            {point.meanHitReactionTimeMs !== null
                              ? `${point.meanHitReactionTimeMs} ms`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs leading-5 text-ink-subtle">
                  No trend table is shown because fewer than two linked scored
                  runs are available.
                </p>
              )}
            </>
          ) : (
            <EmptyState
              icon={Activity}
              title={
                isDemoParticipant
                  ? "No scored CPT measurements in this browser session"
                  : "No CPT measurements linked to this participant"
              }
              description={
                isDemoParticipant
                  ? "Complete a scored CPT run in the participant workspace to populate this report. Practice attempts are not stored."
                  : "The frontend activity store only records runs for the demonstration participant. No values are inferred for this roster record."
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
          )}
        </section>

        <section
          aria-labelledby="report-digital-twin-heading"
          className="space-y-3"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h3
              id="report-digital-twin-heading"
              className="text-sm font-semibold text-ink"
            >
              Digital Twin availability
            </h3>
            <Badge tone="outline">Not a trained model</Badge>
          </div>

          {hasActivityData ? (
            <div className="grid gap-x-8 md:grid-cols-2">
              <ClinicianDetailRow
                label="Research profile"
                value="Descriptive CPT summary"
                detail="Calculated from linked trial events, not a learned representation."
              />
              <ClinicianDetailRow
                label="Baseline comparison"
                value={
                  baselineComparison
                    ? `Accuracy ${formatDelta(
                        baselineComparison.accuracyDelta,
                        "pts",
                      )} · RT ${formatDelta(
                        baselineComparison.reactionTimeDelta,
                        "ms",
                      )}`
                    : "Unavailable"
                }
                detail="Latest run minus first-run reference; descriptive only."
              />
              <ClinicianDetailRow
                label="Learned Digital Twin"
                value="Not available"
                detail="No trained model or inference pipeline exists."
              />
              <ClinicianDetailRow
                label="EEG-derived features"
                value="Unavailable"
                detail="No preprocessing or feature extraction is connected."
              />
            </div>
          ) : (
            <p className="text-sm leading-6 text-ink-muted">
              A research Digital Twin summary is unavailable because no linked
              scored CPT runs exist. No EEG features or model outputs are
              inferred.
            </p>
          )}
        </section>

        <section
          aria-labelledby="report-limitations-heading"
          className="space-y-3"
        >
          <h3
            id="report-limitations-heading"
            className="text-sm font-semibold text-ink"
          >
            Availability and limitations
          </h3>
          <div className="grid gap-x-8 md:grid-cols-2">
            <ClinicianDetailRow
              label="EEG recording"
              value="Unavailable"
              detail="No real EEG signal or recording metadata."
            />
            <ClinicianDetailRow
              label="EEG-derived features"
              value="Not connected"
              detail="No spectral, artifact, or quality analysis."
            />
            <ClinicianDetailRow
              label="Model inference"
              value="Not available"
              detail="No trained model, prediction, or confidence value."
            />
            <ClinicianDetailRow
              label="Session detail linkage"
              value="Unavailable"
              detail="Only roster-level session summaries exist."
            />
            <ClinicianDetailRow
              label="Report persistence"
              value="Browser session only"
              detail="No server-side report record is created."
            />
            <ClinicianDetailRow
              label="Clinical interpretation"
              value="Not provided"
              detail="No diagnosis, severity, prognosis, or treatment recommendation."
            />
          </div>
        </section>

        <section
          aria-labelledby="report-interpretation-heading"
          className="space-y-2 border-t border-line pt-4"
        >
          <h3
            id="report-interpretation-heading"
            className="text-sm font-semibold text-ink"
          >
            Interpretation boundaries
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-ink-muted">
            <li>
              CPT values describe task behavior in this browser session only.
            </li>
            <li>
              The synthetic roster and illustrative EEG preview are not clinical
              evidence.
            </li>
            <li>
              Arithmetic differences between runs do not establish improvement,
              decline, or treatment response.
            </li>
            <li>
              This report is not suitable for diagnosis, clinical decision
              support, or research publication.
            </li>
          </ul>
        </section>

        <footer className="border-t border-line pt-4">
          <p className="text-[11px] leading-5 text-ink-subtle">
            Synthetic demonstration report. No real participant data, EEG
            measurement, model output, or clinical assessment is included.
          </p>
        </footer>
      </article>

      <div className="flex flex-wrap gap-2 print:hidden">
        <ButtonLink
          href={`/clinician/participants/${participant.id}/behavior`}
          variant="outline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Behavioral summary
        </ButtonLink>
        <ButtonLink
          href={`/clinician/participants/${participant.id}/eeg`}
          variant="outline"
        >
          EEG availability
          <ArrowRight aria-hidden="true" className="size-4" />
        </ButtonLink>
        <ButtonLink href="/clinician/compare" variant="outline">
          Session comparison
          <ArrowRight aria-hidden="true" className="size-4" />
        </ButtonLink>
      </div>

      <Alert tone="info" title="Report data is not persisted" className="print:hidden">
        Reloading the browser clears linked in-memory CPT runs. Printing uses the
        browser print dialog; no PDF is generated or stored by the application.
      </Alert>
    </div>
  );
}
