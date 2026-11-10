"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CptEventTable } from "@/features/activities/cpt/cpt-event-table";
import type { CptMetrics, CptTrialEvent } from "@/types";

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-slate-50/50 p-3">
      <dt className="text-xs font-medium text-ink-subtle">{label}</dt>
      <dd className="mt-1 font-mono text-xl font-semibold tracking-tight text-ink">
        {value}
      </dd>
      <dd className="mt-0.5 text-xs leading-5 text-ink-subtle">{detail}</dd>
    </div>
  );
}

export function CptSummary({
  title,
  description,
  mode,
  metrics,
  events,
  savedRunId,
  actions,
  storageMode = "memory",
  cloudSyncEnabled = false,
  persistenceStatus = "not-applicable",
  persistenceMessage,
  persistenceTarget = "firebase",
  onSaveReport,
}: {
  title: string;
  description: string;
  mode: "practice" | "scored";
  metrics: CptMetrics;
  events: CptTrialEvent[];
  savedRunId?: string;
  actions: ReactNode;
  storageMode?: "memory" | "firebase";
  cloudSyncEnabled?: boolean;
  persistenceStatus?: "not-applicable" | "disabled" | "saving" | "saved" | "failed";
  persistenceMessage?: string | null;
  persistenceTarget?: "firebase" | "backend";
  onSaveReport?: () => Promise<unknown>;
}) {
  const toBackend = storageMode === "firebase" && persistenceTarget === "backend";
  const [reportSaving, setReportSaving] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  async function handleSaveReport() {
    if (!onSaveReport || reportSaving || reportSaved) {
      return;
    }

    setReportSaving(true);
    setReportError(null);

    try {
      await onSaveReport();
      setReportSaved(true);
    } catch (error) {
      setReportError(
        error instanceof Error
          ? error.message
          : "The report summary could not be saved.",
      );
    } finally {
      setReportSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge tone={mode === "scored" ? "brand" : "neutral"}>
            {mode === "scored" ? "Scored" : "Practice"}
          </Badge>
          {savedRunId ? (
            <span className="font-mono text-xs text-ink-subtle">
              {savedRunId}
            </span>
          ) : (
            <Badge tone="outline">Not saved</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <section aria-labelledby="cpt-metrics-heading" className="space-y-3">
          <div>
            <h3
              id="cpt-metrics-heading"
              className="text-sm font-semibold text-ink"
            >
              Calculated metrics
            </h3>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Accuracy counts correct detections and correct rejections. Reaction
              time uses correct detections with a valid response time.
            </p>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric
              label="Accuracy"
              value={
                metrics.accuracyPercent !== null
                  ? `${metrics.accuracyPercent}%`
                  : "—"
              }
              detail={`${metrics.trialCount} trials completed`}
            />
            <Metric
              label="Targets detected"
              value={`${metrics.hitCount}/${metrics.targetCount}`}
              detail={`${metrics.missCount} missed target${
                metrics.missCount === 1 ? "" : "s"
              }`}
            />
            <Metric
              label="False alarms"
              value={String(metrics.falseAlarmCount)}
              detail={`${metrics.correctRejectionCount} non-targets correctly withheld`}
            />
            <Metric
              label="Responses"
              value={String(metrics.responseCount)}
              detail={`${metrics.nonTargetCount} non-target trials`}
            />
            <Metric
              label="Mean hit reaction time"
              value={
                metrics.meanHitReactionTimeMs !== null
                  ? `${metrics.meanHitReactionTimeMs} ms`
                  : "—"
              }
              detail={`${metrics.validReactionTimeCount} valid detection${
                metrics.validReactionTimeCount === 1 ? "" : "s"
              }`}
            />
            <Metric
              label="Correct rejections"
              value={String(metrics.correctRejectionCount)}
              detail="Non-target trials with no response"
            />
          </dl>

          <p className="text-xs leading-5 text-ink-subtle">
            These are frontend-calculated CPT demonstration metrics, not a
            clinical score or diagnostic result.
          </p>
        </section>

        <section aria-labelledby="cpt-events-heading" className="space-y-3">
          <div>
            <h3
              id="cpt-events-heading"
              className="text-sm font-semibold text-ink"
            >
              Trial-by-trial events
            </h3>
            <p className="mt-0.5 text-xs text-ink-subtle">
              {toBackend
                ? "With your research consent, these trial events are sent to the research backend, which validates them and calculates the summary. This table is the copy held in this browser."
                : storageMode === "firebase"
                  ? "Trial events remain in this browser. Firebase stores summary metrics only when cloud sync is enabled."
                  : "Measured events are retained in memory for this run and do not leave the browser."}
            </p>
          </div>
          {events.length > 0 ? (
            <CptEventTable events={events} />
          ) : metrics.trialCount > 0 ? (
            <Alert
              tone="info"
              title={toBackend ? "Trial details are held by the research backend" : "Trial details were not stored"}
            >
              {toBackend
                ? "This run was loaded from the research backend, which keeps the trial events and returns the server-calculated summary only."
                : "This saved Firebase activity record contains summary metrics only. Raw trial events and response timelines were not uploaded."}
            </Alert>
          ) : (
            <CptEventTable events={events} />
          )}
        </section>
      </CardContent>

      <CardFooter className="flex-wrap">
        <p className="text-xs text-ink-subtle">
          {mode !== "scored"
            ? "Practice results are shown for review and are not saved."
            : toBackend
              ? persistenceStatus === "saving"
                ? "Saving to the research backend…"
                : persistenceStatus === "failed"
                  ? persistenceMessage ?? "Saving to the research backend failed; the run remains in this browser session."
                  : "Saved to the research backend, including the trial events used to calculate this summary."
            : storageMode === "firebase"
              ? cloudSyncEnabled
                ? persistenceStatus === "saved"
                  ? "Summary synchronization completed; raw trial events remain in the browser."
                  : persistenceStatus === "failed"
                    ? persistenceMessage ?? "Firebase synchronization failed; the run remains in this browser session."
                    : "Cloud sync is enabled for summary fields only; raw trial events remain in the browser."
                : "Cloud sync is off. This scored run remains in browser memory and resets on reload."
              : "This run is held in memory for the current browser session."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {mode === "scored" && onSaveReport ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={reportSaving || reportSaved}
              onClick={() => void handleSaveReport()}
            >
              {reportSaving
                ? "Saving report summary…"
                : reportSaved
                  ? "Report summary saved"
                  : "Save report summary"}
            </Button>
          ) : null}
        </div>
      </CardFooter>
      {reportError ? (
        <div className="px-5 pb-5">
          <Alert tone="danger" title="Report summary was not saved">
            {reportError}
          </Alert>
        </div>
      ) : null}
    </Card>
  );
}
