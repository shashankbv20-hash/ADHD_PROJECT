"use client";

import { ArrowLeft, ListChecks } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ACTIVITY_RESULTS, type ResultRow } from "@/features/activities/activity-results";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import { useRunLog } from "@/features/activities/run-log";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import { formatDateTime } from "@/lib/utils";

const CPT_COLUMNS = ["Accuracy", "Targets detected", "False alarms", "Mean hit time"];

interface Tab {
  id: string;
  title: string;
  href: string;
  columns: string[];
}

const TABS: Tab[] = [
  { id: "cpt", title: "Continuous Performance Task", href: "/participant/activities/cpt", columns: CPT_COLUMNS },
  ...ACTIVITY_RESULTS.map(({ id, title, href, columns }) => ({ id, title, href, columns })),
];

type Row = ResultRow & { detailHref?: string };

function ResultsTable({ tab, rows }: { tab: Tab; rows: Row[] }) {
  const hasDetail = rows.some((row) => row.detailHref);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm text-ink-muted">
        <caption className="sr-only">Previous scored {tab.title} runs</caption>
        <thead>
          <tr className="border-b border-line text-xs text-ink-subtle">
            <th scope="col" className="py-1.5 pr-3 font-medium">When</th>
            {tab.columns.map((column) => (
              <th key={column} scope="col" className="py-1.5 pr-3 font-medium">
                {column}
              </th>
            ))}
            {hasDetail ? <th scope="col" className="py-1.5 font-medium">Details</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line/60">
              <th scope="row" className="py-1.5 pr-3 font-normal text-ink">
                {formatDateTime(row.at)} UTC
              </th>
              {row.cells.map((cell, index) => (
                <td key={index} className="py-1.5 pr-3 font-mono">
                  {cell}
                </td>
              ))}
              {hasDetail ? (
                <td className="py-1.5">
                  {row.detailHref ? (
                    <ButtonLink href={row.detailHref} variant="outline" size="sm">
                      View run
                    </ButtonLink>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ActivityResultsView() {
  const sync = useOptionalBackendSync();
  const { cptRuns } = useActivitySessions();
  const [selectedId, setSelectedId] = useState("cpt");
  const selected = TABS.find((tab) => tab.id === selectedId) ?? TABS[0];
  const definition = ACTIVITY_RESULTS.find((item) => item.id === selected.id);
  const visitRows = useRunLog(definition?.id ?? "go-no-go");

  const rows: Row[] = definition
    ? sync
      ? definition.fromServer(sync)
      : visitRows
    : cptRuns.map((run) => ({
        id: run.id,
        at: run.completedAt,
        cells: [
          run.accuracyPercent === null ? "—" : `${run.accuracyPercent}%`,
          `${run.hitCount}/${run.targetCount}`,
          String(run.falseAlarmCount),
          run.meanHitReactionTimeMs === null ? "—" : `${run.meanHitReactionTimeMs} ms`,
        ],
        detailHref: `/participant/activities/history/${run.id}`,
      }));

  const fromServer = Boolean(sync);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Results by activity"
        description="Pick an activity to see the results of its previous scored sessions, newest first. Each activity is listed separately because each one measures something different."
        meta={
          <Badge tone={fromServer ? "success" : "brand"} dot>
            {fromServer ? "Research backend" : "This browser session"}
          </Badge>
        }
        actions={
          <ButtonLink href="/participant/activities" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to activities
          </ButtonLink>
        }
      />

      <Alert tone="info" title={fromServer ? "Saved runs" : "Results reset on reload"}>
        {fromServer
          ? "These are scored runs saved to the research backend with your consent. The server validated the trials and calculated every value shown. Runs that were not saved (for example without consent) do not appear."
          : "Results are held in memory for this browser session only, so reloading the page clears them. Practice runs are never recorded."}
      </Alert>

      <div role="group" aria-label="Choose an activity" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={tab.id === selected.id}
            onClick={() => setSelectedId(tab.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              tab.id === selected.id
                ? "border-brand-600 bg-brand-50 text-brand-800"
                : "border-line text-ink-muted hover:bg-surface-muted"
            }`}
          >
            {tab.title}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{selected.title}</CardTitle>
            <CardDescription>
              {rows.length} recorded run{rows.length === 1 ? "" : "s"}, newest first.
            </CardDescription>
          </div>
          <ListChecks aria-hidden="true" className="size-5 shrink-0 text-brand-600" />
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title={`No ${selected.title} runs yet`}
              description="Complete a scored run of this activity to add it here. Practice results are shown once but are not saved."
              action={<ButtonLink href={selected.href}>Open {selected.title}</ButtonLink>}
            />
          ) : (
            <ResultsTable tab={selected} rows={rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
