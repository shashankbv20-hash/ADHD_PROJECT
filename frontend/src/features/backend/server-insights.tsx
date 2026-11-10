"use client";

import { ArrowRight, FileText } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBackendSync } from "@/features/backend/backend-sync-provider";
import { formatDateTime } from "@/lib/utils";

function display(value: number | null | undefined, suffix = ""): string {
  return value === null || value === undefined ? "—" : `${value}${suffix}`;
}

function signed(value: number | null, suffix: string): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">{label}</dt>
      <dd className="mt-1 font-mono text-lg font-semibold text-ink">{value}</dd>
      {detail ? <dd className="mt-0.5 text-xs text-ink-subtle">{detail}</dd> : null}
    </div>
  );
}

/** The Digital Twin as calculated and versioned by the research backend. */
export function ServerDigitalTwinCard() {
  const { status, twin, twinHistory } = useBackendSync();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Digital Twin from the research backend</CardTitle>
          {twin ? <Badge tone="brand">Version {twin.version}</Badge> : null}
          {twin?.status === "available" ? <Badge tone="success">Available</Badge> : null}
          {twin?.status === "insufficient_data" ? <Badge tone="outline">Not enough data</Badge> : null}
        </div>
        <CardDescription>
          Calculated by the server from runs you saved after granting consent. Each update creates a
          new version; earlier versions are kept. Descriptive CPT measurements only — not a
          diagnosis or a learned model.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {status === "loading" ? (
          <p role="status" className="text-xs text-ink-subtle">
            Loading the server profile…
          </p>
        ) : null}

        {status === "ready" && (!twin || twin.summaryCount === 0) ? (
          <p className="text-sm leading-6 text-ink-muted">
            No runs have been saved to the research backend yet. Grant consent, then complete a scored
            CPT run; the server profile appears here once at least one run is saved, and trend
            figures need two or more.
          </p>
        ) : null}

        {twin && twin.summaryCount > 0 ? (
          <>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Saved runs" value={String(twin.summaryCount)} />
              <Metric
                label="Overall accuracy"
                value={display(twin.metrics?.accuracyPercent, "%")}
                detail="Across all saved runs"
              />
              <Metric
                label="Mean hit reaction time"
                value={display(twin.metrics?.meanHitReactionTimeMs, " ms")}
              />
              <Metric
                label="Observation window"
                value={twin.observationStart ? formatDateTime(twin.observationStart) : "—"}
                detail={
                  twin.observationEnd && twin.observationEnd !== twin.observationStart
                    ? `to ${formatDateTime(twin.observationEnd)} UTC`
                    : "UTC"
                }
              />
            </dl>

            {twin.status === "available" ? (
              <dl className="grid gap-4 border-t border-line/70 pt-4 sm:grid-cols-2">
                <Metric
                  label="Accuracy change (latest vs first)"
                  value={signed(twin.accuracyDeltaPoints, " pts")}
                />
                <Metric
                  label="Reaction time change (latest vs first)"
                  value={signed(twin.meanHitReactionTimeDeltaMs, " ms")}
                  detail="Negative means faster"
                />
              </dl>
            ) : null}

            {twin.qualityFlags.length > 0 ? (
              <Alert tone="info" title="Data quality notes">
                {twin.qualityFlags.map((flag) => flag.replaceAll("_", " ")).join(" · ")}
              </Alert>
            ) : null}
          </>
        ) : null}

        {twinHistory.length > 0 ? (
          <div className="space-y-2 border-t border-line/70 pt-4">
            <h3 className="text-sm font-semibold text-ink">Version history</h3>
            <ul className="space-y-1.5">
              {twinHistory.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-xs text-ink-muted"
                >
                  <span className="font-medium text-ink">Version {entry.version}</span>
                  <span>
                    {entry.sourceCount} run{entry.sourceCount === 1 ? "" : "s"} · accuracy{" "}
                    {display(entry.accuracyPercent, "%")}
                  </span>
                  <span className="font-mono text-ink-subtle">
                    {formatDateTime(entry.createdAt)} UTC · {entry.algorithmVersion}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Reports generated by the backend from saved summaries. */
export function ServerReportsCard() {
  const { status, reports, serverRuns, consent, reportBusy, reportError, createReport } =
    useBackendSync();
  const canCreate = consent.status === "granted" && serverRuns.length > 0 && !reportBusy;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Research reports</CardTitle>
          <Badge tone="outline">{reports.length} saved</Badge>
        </div>
        <CardDescription>
          A report is a snapshot of your saved runs, generated by the server. Creating a report is
          your choice; asking again for the same set of runs returns the same report.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void createReport()} disabled={!canCreate}>
            <FileText aria-hidden="true" className="size-4" />
            {reportBusy ? "Creating report…" : "Create report from saved runs"}
          </Button>
          {consent.status !== "granted" ? (
            <span className="text-xs text-ink-subtle">Requires active research consent.</span>
          ) : serverRuns.length === 0 ? (
            <span className="text-xs text-ink-subtle">Save a scored run first.</span>
          ) : null}
        </div>

        {reportError ? (
          <Alert tone="danger" title="Report was not created">
            {reportError}
          </Alert>
        ) : null}

        {status === "ready" && reports.length === 0 ? (
          <p className="text-sm text-ink-muted">No reports have been created yet.</p>
        ) : null}

        <ul className="space-y-2">
          {reports.map((report) => (
            <li key={report.id} className="rounded-lg border border-line p-3 text-xs text-ink-muted">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">
                  {report.summaryCount ?? "?"} run{report.summaryCount === 1 ? "" : "s"} · accuracy{" "}
                  {display(report.metrics?.accuracyPercent, "%")} · mean hit RT{" "}
                  {display(report.metrics?.meanHitReactionTimeMs, " ms")}
                </span>
                <span className="font-mono text-ink-subtle">
                  {formatDateTime(report.createdAt)} UTC · {report.templateVersion}
                </span>
              </div>
              {report.limitations.length > 0 ? (
                <p className="mt-1.5 leading-5 text-ink-subtle">{report.limitations.join(" ")}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Sessions stored by the research backend. */
export function ServerSessionsCard() {
  const { status, sessions } = useBackendSync();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Sessions saved to the research backend</CardTitle>
          <Badge tone="outline">{sessions.length}</Badge>
        </div>
        <CardDescription>
          CPT sessions validated and scored by the server. Trial events are stored with the session;
          the summary values shown elsewhere are calculated from them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {status === "ready" && sessions.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No sessions saved yet. Grant research consent and complete a scored CPT run.
          </p>
        ) : null}

        {sessions.map((session) => {
          const activity = session.activities.find((item) => item.activityCode === "cpt");

          return (
            <article
              key={session.id}
              className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">Continuous Performance Task</span>
                  <Badge tone={session.status === "completed" ? "success" : "outline"}>
                    {session.status}
                  </Badge>
                  {activity ? <Badge tone="outline">{activity.mode}</Badge> : null}
                </div>
                <p className="font-mono text-xs text-ink-subtle">
                  {session.id} · {formatDateTime(session.createdAt)} UTC
                </p>
              </div>
              {activity?.status === "completed" ? (
                <ButtonLink
                  href={`/participant/activities/history/${activity.id}`}
                  variant="outline"
                  size="sm"
                >
                  View CPT summary
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </ButtonLink>
              ) : null}
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}
