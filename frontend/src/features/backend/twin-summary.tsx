import { Alert } from "@/components/ui/alert";
import type { ServerReportView, ServerTwinHistoryEntry, ServerTwinView } from "@/lib/backend/twin";
import { TwinInsightsPanel } from "@/features/backend/twin-insights";
import { display, Metric, signed } from "@/features/backend/twin-summary-parts";
import { formatDateTime } from "@/lib/utils";

/** Presentational Twin body, shared by the participant and the read-only caregiver views. */
export function TwinSummary({
  loading,
  twin,
  twinHistory,
  emptyMessage,
}: {
  loading: boolean;
  twin: ServerTwinView | null;
  twinHistory: ServerTwinHistoryEntry[];
  emptyMessage: string;
}) {
  return (
    <div className="space-y-5">
      {loading ? (
        <p role="status" className="text-xs text-ink-subtle">
          Loading the server profile…
        </p>
      ) : null}

      {!loading && (!twin || twin.summaryCount === 0) ? (
        <p className="text-sm leading-6 text-ink-muted">{emptyMessage}</p>
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

          <TwinInsightsPanel insights={twin.insights} />

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
    </div>
  );
}

export function ReportList({
  reports,
  onDownloadPdf,
}: {
  reports: ServerReportView[];
  /** Offered only where the viewer is allowed to download (participant). */
  onDownloadPdf?: (reportId: string) => void;
}) {
  return (
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
          {onDownloadPdf ? (
            <button
              type="button"
              onClick={() => onDownloadPdf(report.id)}
              className="mt-2 text-xs font-medium text-brand-700 underline underline-offset-2"
            >
              Download PDF
            </button>
          ) : null}
          {report.limitations.length > 0 ? (
            <p className="mt-1.5 leading-5 text-ink-subtle">{report.limitations.join(" ")}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
