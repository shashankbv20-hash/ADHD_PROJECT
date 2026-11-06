"use client";

import {
  ArrowLeft,
  ArrowLeftRight,
  CircleSlash2,
  ListChecks,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import { Label, Select } from "@/components/ui/input";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import {
  buildCptComparisonMeasures,
  canCompareCptRuns,
  getComparableParticipantIds,
  getEligibleCptRuns,
  type CptComparisonMeasure,
  type CptComparisonUnit,
} from "@/features/clinician/clinician-comparison-data";
import { ClinicianDetailRow } from "@/features/clinician/clinician-rows";
import { ClinicianMetricCard } from "@/features/clinician/clinician-metric-card";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ClinicianParticipant, CptRunSummary, DemoMeta } from "@/types";

function sortNewestFirst(runs: CptRunSummary[]): CptRunSummary[] {
  return [...runs].sort(
    (a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );
}

function formatMeasureValue(
  value: number | null,
  unit: CptComparisonUnit,
): string {
  if (value === null) {
    return "—";
  }

  if (unit === "percent") {
    return `${value}%`;
  }

  if (unit === "milliseconds") {
    return `${value} ms`;
  }

  return String(value);
}

function formatDifference(
  measure: CptComparisonMeasure,
): string {
  if (measure.difference === null) {
    return "Not comparable";
  }

  if (measure.difference === 0) {
    return `0 ${measure.unit === "percent" ? "pts" : measure.unit === "milliseconds" ? "ms" : ""}`.trim();
  }

  const sign = measure.difference > 0 ? "+" : "";
  const unit =
    measure.unit === "percent"
      ? "pts"
      : measure.unit === "milliseconds"
        ? "ms"
        : "";

  return `${sign}${measure.difference} ${unit}`.trim();
}

function RunOptionLabel({ run }: { run: CptRunSummary }) {
  return `${run.id} · ${formatDate(run.completedAt)} · ${
    run.accuracyPercent !== null ? `${run.accuracyPercent}%` : "no accuracy"
  }`;
}

export function ClinicianSessionComparison({
  participants,
  meta,
}: {
  participants: ClinicianParticipant[];
  meta: DemoMeta;
}) {
  const { cptRuns } = useActivitySessions();
  const [participantId, setParticipantId] = useState("");
  const [sessionAId, setSessionAId] = useState("");
  const [sessionBId, setSessionBId] = useState("");

  const eligibleRuns = useMemo(() => getEligibleCptRuns(cptRuns), [cptRuns]);
  const eligibleParticipantIds = useMemo(
    () => getComparableParticipantIds(cptRuns),
    [cptRuns],
  );
  const eligibleParticipants = useMemo(
    () =>
      participants.filter((participant) =>
        eligibleParticipantIds.includes(participant.id),
      ),
    [eligibleParticipantIds, participants],
  );

  const participantRuns = useMemo(
    () =>
      sortNewestFirst(
        eligibleRuns.filter((run) => run.participantId === participantId),
      ),
    [eligibleRuns, participantId],
  );

  const sessionA =
    participantRuns.find((run) => run.id === sessionAId) ?? null;
  const sessionB =
    participantRuns.find((run) => run.id === sessionBId) ?? null;
  const comparisonAvailable =
    sessionA !== null &&
    sessionB !== null &&
    canCompareCptRuns(sessionA, sessionB);

  const measures = useMemo(
    () =>
      comparisonAvailable && sessionA && sessionB
        ? buildCptComparisonMeasures(sessionA, sessionB)
        : [],
    [comparisonAvailable, sessionA, sessionB],
  );

  const selectedParticipant =
    participants.find((participant) => participant.id === participantId) ??
    null;

  function handleParticipantChange(nextParticipantId: string) {
    const nextRuns = sortNewestFirst(
      eligibleRuns.filter((run) => run.participantId === nextParticipantId),
    );

    setParticipantId(nextParticipantId);
    setSessionAId(nextRuns[0]?.id ?? "");
    setSessionBId(nextRuns[1]?.id ?? "");
  }

  function handleSessionAChange(nextSessionId: string) {
    setSessionAId(nextSessionId);

    if (nextSessionId === sessionBId) {
      const fallback = participantRuns.find(
        (run) => run.id !== nextSessionId,
      );
      setSessionBId(fallback?.id ?? "");
    }
  }

  function handleSessionBChange(nextSessionId: string) {
    setSessionBId(nextSessionId);

    if (nextSessionId === sessionAId) {
      const fallback = participantRuns.find(
        (run) => run.id !== nextSessionId,
      );
      setSessionAId(fallback?.id ?? "");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinician workspace"
        title="Session comparison"
        description="Compare two eligible scored CPT runs from the same participant. Differences are descriptive and are not a judgment of clinical improvement, decline, or treatment response."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning" dot>
              In-memory data
            </Badge>
            <span className="text-xs text-ink-subtle">
              CPT comparison only
            </span>
            <span className="text-xs text-ink-subtle">
              EEG comparison unavailable
            </span>
          </div>
        }
        actions={
          <ButtonLink href="/clinician" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Clinician overview
          </ButtonLink>
        }
      />

      <DemoNotice meta={meta} />

      <Alert tone="warning" title="Eligible in-memory runs only">
        A run is eligible when it is a scored CPT run, has a participant ID, has
        a complete trial log, and has a calculated accuracy value. Comparisons
        require two different eligible runs from the same participant.
      </Alert>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ClinicianMetricCard
          icon={ListChecks}
          label="Eligible runs"
          value={String(eligibleRuns.length)}
          detail="Complete scored CPT runs with participant linkage."
        />
        <ClinicianMetricCard
          icon={Users}
          label="Comparable participants"
          value={String(eligibleParticipants.length)}
          detail="Participants with at least two eligible runs."
        />
        <ClinicianMetricCard
          icon={ArrowLeftRight}
          label="Selected participant"
          value={selectedParticipant ? selectedParticipant.researchCode : "—"}
          detail={
            selectedParticipant
              ? `${participantRuns.length} eligible run${
                  participantRuns.length === 1 ? "" : "s"
                } available.`
              : "Choose a participant to begin."
          }
        />
        <ClinicianMetricCard
          icon={CircleSlash2}
          label="EEG comparison"
          value="Unavailable"
          detail="No EEG recording or derived feature is linked."
        />
      </dl>

      {eligibleParticipants.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <EmptyState
              icon={ArrowLeftRight}
              title="No comparable sessions yet"
              description="At least one participant needs two eligible scored CPT runs in this browser session. Complete additional scored runs in the participant workspace; practice attempts do not count."
              action={
                <ButtonLink href="/participant/activities/cpt">
                  Open the CPT
                </ButtonLink>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Select sessions</CardTitle>
              <CardDescription>
                Only participants with at least two eligible runs are listed.
                Session options are limited to the selected participant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xl space-y-1.5">
                <Label htmlFor="comparison-participant">Participant</Label>
                <Select
                  id="comparison-participant"
                  value={participantId}
                  onChange={(event) =>
                    handleParticipantChange(event.target.value)
                  }
                >
                  <option value="">Select a participant</option>
                  {eligibleParticipants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.displayName} ({participant.researchCode})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="comparison-session-a">Session A</Label>
                  <Select
                    id="comparison-session-a"
                    value={sessionAId}
                    onChange={(event) =>
                      handleSessionAChange(event.target.value)
                    }
                    disabled={participantRuns.length < 2}
                  >
                    {participantRuns.length === 0 ? (
                      <option value="">No eligible runs</option>
                    ) : null}
                    {participantRuns.map((run) => (
                      <option key={run.id} value={run.id}>
                        <RunOptionLabel run={run} />
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="comparison-session-b">Session B</Label>
                  <Select
                    id="comparison-session-b"
                    value={sessionBId}
                    onChange={(event) =>
                      handleSessionBChange(event.target.value)
                    }
                    disabled={participantRuns.length < 2}
                  >
                    {participantRuns.length === 0 ? (
                      <option value="">No eligible runs</option>
                    ) : null}
                    {participantRuns.map((run) => (
                      <option key={run.id} value={run.id}>
                        <RunOptionLabel run={run} />
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {participantId && participantRuns.length < 2 ? (
                <p className="text-xs leading-5 text-ink-subtle">
                  This participant has fewer than two eligible scored runs.
                  Complete another scored run to enable comparison.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {comparisonAvailable && sessionA && sessionB ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Session A</CardTitle>
                    <CardDescription>
                      {sessionA.id} · {formatDateTime(sessionA.completedAt)} UTC
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ClinicianDetailRow
                      label="Accuracy"
                      value={
                        sessionA.accuracyPercent !== null
                          ? `${sessionA.accuracyPercent}%`
                          : "—"
                      }
                    />
                    <ClinicianDetailRow
                      label="Scored trials"
                      value={String(sessionA.trialCount)}
                    />
                    <ClinicianDetailRow
                      label="Mean hit RT"
                      value={
                        sessionA.meanHitReactionTimeMs !== null
                          ? `${sessionA.meanHitReactionTimeMs} ms`
                          : "—"
                      }
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Session B</CardTitle>
                    <CardDescription>
                      {sessionB.id} · {formatDateTime(sessionB.completedAt)} UTC
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ClinicianDetailRow
                      label="Accuracy"
                      value={
                        sessionB.accuracyPercent !== null
                          ? `${sessionB.accuracyPercent}%`
                          : "—"
                      }
                    />
                    <ClinicianDetailRow
                      label="Scored trials"
                      value={String(sessionB.trialCount)}
                    />
                    <ClinicianDetailRow
                      label="Mean hit RT"
                      value={
                        sessionB.meanHitReactionTimeMs !== null
                          ? `${sessionB.meanHitReactionTimeMs} ms`
                          : "—"
                      }
                    />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>CPT comparison</CardTitle>
                    <CardDescription>
                      Session B minus Session A. Differences are shown only when
                      both sessions contain a value for the measure.
                    </CardDescription>
                  </div>
                  <Badge tone="outline">Descriptive</Badge>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                      <caption className="sr-only">
                        Comparison of CPT measures between Session A and Session
                        B
                      </caption>
                      <thead>
                        <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-subtle">
                          <th scope="col" className="py-2.5 pr-4 font-medium">
                            Measure
                          </th>
                          <th scope="col" className="py-2.5 pr-4 font-medium">
                            Session A
                          </th>
                          <th scope="col" className="py-2.5 pr-4 font-medium">
                            Session B
                          </th>
                          <th scope="col" className="py-2.5 font-medium">
                            Difference
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {measures.map((measure) => (
                          <tr
                            key={measure.id}
                            className="border-b border-line/70 last:border-0"
                          >
                            <th
                              scope="row"
                              className="py-2.5 pr-4 font-medium text-ink"
                            >
                              {measure.label}
                            </th>
                            <td className="py-2.5 pr-4 font-mono text-xs text-ink-muted">
                              {formatMeasureValue(
                                measure.sessionA,
                                measure.unit,
                              )}
                            </td>
                            <td className="py-2.5 pr-4 font-mono text-xs text-ink-muted">
                              {formatMeasureValue(
                                measure.sessionB,
                                measure.unit,
                              )}
                            </td>
                            <td className="py-2.5 font-mono text-xs text-ink-muted">
                              {formatDifference(measure)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-ink-subtle">
                    A positive accuracy difference means Session B had a higher
                    percentage. A positive reaction-time difference means
                    Session B was slower. These are arithmetic differences, not
                    clinical interpretations.
                  </p>
                </CardContent>
              </Card>
            </>
          ) : participantId ? (
            <Alert tone="info" title="Comparison not available">
              Select two different eligible sessions for the same participant.
              No comparison is shown when a value is missing or when the
              sessions cannot be matched.
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Comparison scope</CardTitle>
              <CardDescription>
                What this comparison does and does not include.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClinicianDetailRow
                label="Compared activity"
                value="CPT only"
                detail="Other activity types are not included."
              />
              <ClinicianDetailRow
                label="Participant matching"
                value="Same participant only"
                detail="Runs from different participants are never compared."
              />
              <ClinicianDetailRow
                label="Trial-log requirement"
                value="Complete logs only"
                detail="Runs with missing trial events are excluded."
              />
              <ClinicianDetailRow
                label="EEG comparison"
                value="Unavailable"
                detail="No EEG recording, derived feature, or model output exists."
              />
              <ClinicianDetailRow
                label="Clinical interpretation"
                value="Not provided"
                detail="The comparison does not assess diagnosis, severity, or treatment effect."
              />
            </CardContent>
          </Card>
        </>
      )}

      <Alert tone="info" title="In-memory comparison data">
        Eligible runs exist only for the current browser session and reset on
        reload. No server-side session history, EEG comparison, or model
        inference is available.
      </Alert>
    </div>
  );
}
