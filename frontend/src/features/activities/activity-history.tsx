"use client";

import {
  ArrowLeft,
  ArrowRight,
  ListChecks,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { participantDemoMeta } from "@/data/demo/participant";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import { formatDateTime } from "@/lib/utils";
import type { CptRunSummary } from "@/types";

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

function RunRow({ run }: { run: CptRunSummary }) {
  return (
    <article className="rounded-xl border border-line p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">
              Continuous Performance Task
            </h3>
            <Badge tone="success" dot>
              Completed
            </Badge>
            <Badge tone={run.mode === "scored" ? "brand" : "neutral"}>
              {run.mode === "scored" ? "Scored" : "Practice"}
            </Badge>
            {run.events.length < run.trialCount ? (
              <Badge tone="outline">Summary only</Badge>
            ) : null}
          </div>
          <p className="font-mono text-xs text-ink-subtle">
            {run.id} · {formatDateTime(run.completedAt)} UTC
          </p>
        </div>

        <ButtonLink
          href={`/participant/activities/history/${run.id}`}
          variant="outline"
          size="sm"
          aria-label={`View ${run.id}`}
        >
          View run
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </ButtonLink>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line/70 pt-4 sm:grid-cols-3 lg:grid-cols-6">
        <RunMetric label="Trials" value={String(run.trialCount)} />
        <RunMetric
          label="Accuracy"
          value={
            run.accuracyPercent !== null ? `${run.accuracyPercent}%` : "—"
          }
        />
        <RunMetric
          label="Targets detected"
          value={`${run.hitCount}/${run.targetCount}`}
        />
        <RunMetric label="False alarms" value={String(run.falseAlarmCount)} />
        <RunMetric label="Responses" value={String(run.responseCount)} />
        <RunMetric
          label="Mean hit RT"
          value={
            run.meanHitReactionTimeMs !== null
              ? `${run.meanHitReactionTimeMs} ms`
              : "—"
          }
        />
      </dl>
    </article>
  );
}

export function ActivityHistory() {
  const {
    cptRuns,
    clearCptRuns,
    storageMode,
    persistenceTarget,
    cloudSyncEnabled,
    canClearCptRuns,
    unsyncedRunCount,
  } = useActivitySessions();
  const { account } = useFirebaseAuth();
  const backendSync = useOptionalBackendSync();
  const isFirebase = storageMode === "firebase";
  const toBackend = isFirebase && persistenceTarget === "backend";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Activity history"
        description={
          toBackend
            ? "Review CPT summaries saved to the research backend, earlier Firebase summaries, and runs from this browser session. Saved runs show server-calculated values; the backend keeps their trial events."
            : isFirebase
            ? "Review CPT summaries available to this signed-in account and current browser session. Firebase records contain summary metrics, not trial-by-trial events."
            : "Review completed CPT runs recorded in this browser session. Each record links to its calculated metrics and trial-by-trial events."
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isFirebase ? "success" : "brand"} dot>
              {toBackend ? "Research backend" : isFirebase ? "Firebase account" : "In-memory"}
            </Badge>
            <span className="text-xs text-ink-subtle">
              {cptRuns.length} recorded run{cptRuns.length === 1 ? "" : "s"}
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink href="/participant/activities" variant="outline">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to activities
            </ButtonLink>
            <ButtonLink href="/participant/activities/cpt">
              Try the CPT
            </ButtonLink>
          </>
        }
      />

      {toBackend ? (
        <Alert tone="info" title="Saved through the research backend">
          With your research consent, scored runs are sent to the backend, which stores the trial events
          and calculates the summary. Runs that could not be saved yet stay in this browser session
          {unsyncedRunCount > 0 ? ` (${unsyncedRunCount} waiting)` : ""}. Older Firebase summaries are
          kept as they are.
        </Alert>
      ) : isFirebase ? (
        <Alert tone="info" title="Summary-only cloud history">
          {cloudSyncEnabled
            ? "New scored summaries are saved to this participant account. Raw trial events are never uploaded."
            : "Cloud sync is off. Previously saved summaries remain readable, while new runs stay only in this browser."}
        </Alert>
      ) : (
        <>
          <DemoNotice meta={participantDemoMeta} />
          <Alert tone="info" title="History resets on reload">
            Activity records are held only in memory for the current browser
            session. Reloading the page or clearing history removes them. Practice
            results are shown once and are not added to history.
          </Alert>
        </>
      )}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Recorded runs</CardTitle>
            <CardDescription>
              {toBackend
                ? "Newest first. Saved entries show server-calculated summary values; runs from this browser session may include trial details."
                : isFirebase
                ? "Newest first. Saved Firebase entries contain summary metrics only; browser-local runs may include trial details."
                : "Newest first. Open a run for its full summary and raw trial-event review."}
            </CardDescription>
          </div>
          <ListChecks
            aria-hidden="true"
            className="size-5 shrink-0 text-brand-600"
          />
        </CardHeader>

        {cptRuns.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={ListChecks}
              title="No recorded activity runs"
              description="Complete a scored CPT run to add it here. Practice results are shown once but are not saved."
              action={
                <ButtonLink href="/participant/activities/cpt">
                  Try the CPT
                </ButtonLink>
              }
            />
          </CardContent>
        ) : (
          <CardContent className="space-y-3">
            {cptRuns.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </CardContent>
        )}

        <CardFooter className="flex-wrap">
          <p className="text-xs text-ink-subtle">
            {toBackend
              ? `${backendSync?.serverRuns.length ?? 0} saved to the research backend · ${account?.activityRuns.length ?? 0} earlier Firebase summaries · ${unsyncedRunCount} not saved yet`
              : isFirebase
              ? `${account?.activityRuns.length ?? 0} Firebase summaries · ${Math.max(0, cptRuns.length - (account?.activityRuns.length ?? 0))} browser-only runs`
              : `${cptRuns.length} in-memory run${cptRuns.length === 1 ? "" : "s"} · not persisted`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/participant/progress"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
            >
              View progress
              <ArrowRight aria-hidden="true" className="size-3" />
            </Link>
            {cptRuns.length > 0 && canClearCptRuns ? (
              <Button variant="ghost" size="sm" onClick={clearCptRuns}>
                <RotateCcw aria-hidden="true" className="size-3.5" />
                Clear history
              </Button>
            ) : isFirebase && cptRuns.length > 0 ? (
              <span className="text-xs text-ink-subtle">
                Cloud records are retained when sync is turned off.
              </span>
            ) : null}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
