"use client";

import {
  ArrowLeft,
  ArrowRight,
  CircleX,
  Gauge,
  ListChecks,
  Percent,
  Target,
  Timer,
  TrendingUp,
  type LucideIcon,
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { participantDemoMeta } from "@/data/demo/participant";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import { CptProgressCharts } from "@/features/activities/cpt/cpt-progress-charts";
import { buildCptProgressSummary } from "@/features/activities/cpt/cpt-progress-data";
import { formatDateTime } from "@/lib/utils";
import type { CptRunSummary } from "@/types";

function ProgressMetric({
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
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
      </div>
      <dt className="mt-4 text-xs font-medium text-ink-subtle">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-semibold tracking-tight text-ink">
        {value}
      </dd>
      <dd className="mt-1 text-xs leading-5 text-ink-subtle">{detail}</dd>
    </Card>
  );
}

function LatestRunMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function LatestRunCard({
  run,
  storageMode,
}: {
  run: CptRunSummary;
  storageMode: "memory" | "firebase";
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Latest scored run</CardTitle>
        <CardDescription>
          {storageMode === "firebase"
            ? "Most recent scored CPT summary available to this account or browser session."
            : "Most recent scored CPT record in this browser session."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{run.id}</Badge>
          <span className="text-xs text-ink-subtle">
            {formatDateTime(run.completedAt)} UTC
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-4">
          <LatestRunMetric
            label="Accuracy"
            value={
              run.accuracyPercent !== null
                ? `${run.accuracyPercent}%`
                : "—"
            }
          />
          <LatestRunMetric
            label="Targets"
            value={`${run.hitCount}/${run.targetCount}`}
          />
          <LatestRunMetric
            label="False alarms"
            value={String(run.falseAlarmCount)}
          />
          <LatestRunMetric
            label="Mean hit RT"
            value={
              run.meanHitReactionTimeMs !== null
                ? `${run.meanHitReactionTimeMs} ms`
                : "—"
            }
          />
        </dl>
      </CardContent>

      <CardFooter className="flex-wrap">
        <p className="text-xs text-ink-subtle">
          Calculated from {run.trialCount} scored trials.
        </p>
        <ButtonLink
          href={`/participant/activities/history/${run.id}`}
          variant="outline"
          size="sm"
        >
          Open run
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </ButtonLink>
      </CardFooter>
    </Card>
  );
}

function EmptyProgressState({
  storageMode,
}: {
  storageMode: "memory" | "firebase";
}) {
  return (
    <Card>
      <CardContent className="py-6">
        <EmptyState
          icon={TrendingUp}
          title="No scored CPT runs yet"
          description={
            storageMode === "firebase"
              ? "Progress uses this account's saved CPT summaries and current browser runs. Complete a scored run; summary sync requires the opt-in setting."
              : "Progress is calculated from completed scored CPT runs stored in this browser session. Complete a scored run to see aggregate metrics and trends."
          }
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
  );
}

export function CptProgressView() {
  const { cptRuns, storageMode, cloudSyncEnabled, persistenceTarget } = useActivitySessions();
  const toBackend = storageMode === "firebase" && persistenceTarget === "backend";
  const isFirebase = storageMode === "firebase";
  const {
    scoredRuns,
    aggregate,
    latestRun,
    trendPoints,
    hasTrend,
  } = buildCptProgressSummary(cptRuns);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Progress"
        description={
          isFirebase
            ? "Descriptive CPT metrics from saved account summaries and current browser runs. These values are not clinical scores or diagnostic results."
            : "Descriptive CPT metrics calculated from scored runs in this browser session. These values are not clinical scores or diagnostic results."
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isFirebase ? "success" : "brand"} dot>
              {isFirebase ? "Firebase account" : "In-memory"}
            </Badge>
            <span className="text-xs text-ink-subtle">
              {scoredRuns.length} scored run{scoredRuns.length === 1 ? "" : "s"}
            </span>
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
            <ButtonLink href="/participant" variant="outline">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to overview
            </ButtonLink>
          </>
        }
      />

      {toBackend ? (
        <Alert tone="info" title="Saved runs come from the research backend">
          Saved runs show server-calculated metrics; the backend keeps their trial events. Runs from
          this browser session that are not saved yet are included too.
        </Alert>
      ) : isFirebase ? (
        <Alert tone="info" title="Summary metrics only">
          {cloudSyncEnabled
            ? "Saved CPT records contain per-run metrics only. Trial events and response timelines remain in the browser."
            : "Cloud sync is off. Existing saved summaries are readable; new runs remain browser-only."}
        </Alert>
      ) : (
        <DemoNotice meta={participantDemoMeta} />
      )}

        <Alert tone="info" title="Progress scope">
          Only completed scored CPT runs are included. Practice trials are
          excluded, and trends require at least two scored runs.{" "}
          {toBackend
            ? "Saved runs are stored by the research backend after you grant consent."
            : "Firebase saves summary metrics only when the account preference is enabled."}
        </Alert>

      {scoredRuns.length === 0 ? (
        <EmptyProgressState storageMode={storageMode} />
      ) : (
        <>
          <section
            aria-labelledby="progress-metrics-heading"
            className="space-y-3"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2
                  id="progress-metrics-heading"
                  className="text-sm font-semibold text-ink"
                >
                  Aggregate metrics
                </h2>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  Calculated from {scoredRuns.length} scored run
                  {scoredRuns.length === 1 ? "" : "s"} and{" "}
                  {aggregate.trialCount} scored trials.
                </p>
              </div>
              <Badge tone="outline">Descriptive only</Badge>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <ProgressMetric
                icon={ListChecks}
                label="Completed runs"
                value={String(scoredRuns.length)}
                detail={isFirebase ? "Account and browser summaries" : "Scored runs in memory"}
              />
              <ProgressMetric
                icon={Gauge}
                label="Scored trials"
                value={String(aggregate.trialCount)}
                detail="All recorded scored trials"
              />
              <ProgressMetric
                icon={Percent}
                label="Aggregate accuracy"
                value={
                  aggregate.accuracyPercent !== null
                    ? `${aggregate.accuracyPercent}%`
                    : "—"
                }
                detail="Hits plus correct rejections"
              />
              <ProgressMetric
                icon={Target}
                label="Target detections"
                value={`${aggregate.hitCount}/${aggregate.targetCount}`}
                detail={`${aggregate.missCount} missed target${
                  aggregate.missCount === 1 ? "" : "s"
                }`}
              />
              <ProgressMetric
                icon={CircleX}
                label="False alarms"
                value={String(aggregate.falseAlarmCount)}
                detail={`${aggregate.correctRejectionCount} correct rejection${
                  aggregate.correctRejectionCount === 1 ? "" : "s"
                }`}
              />
              <ProgressMetric
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
          </section>

          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            {latestRun ? (
              <LatestRunCard run={latestRun} storageMode={storageMode} />
            ) : null}

            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Raw events vs calculated metrics</CardTitle>
                <CardDescription>
                  Every value is derived using shared CPT calculations. Firebase
                  summary records do not retain the raw trial log.
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 space-y-4 text-sm leading-6 text-ink-muted">
                <div>
                  <p className="font-medium text-ink">Raw trial events</p>
                  <p>
                    {toBackend
                      ? "Each browser run records trial details locally. With your research consent they are also sent to the research backend, which stores them and calculates the saved summary."
                      : "Each browser run records trial details locally. Firebase retains summary metrics only; raw events are not uploaded."}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-ink">Accuracy</p>
                  <p>
                    Correct detections plus correct rejections divided by scored
                    trials.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-ink">Mean hit reaction time</p>
                  <p>
                    Average of valid reaction times for correct detections only.
                  </p>
                </div>
              </CardContent>

              <CardFooter className="flex-wrap">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link
                    href="/participant/activities/history"
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
                  >
                    Review raw trial events
                    <ArrowRight aria-hidden="true" className="size-3" />
                  </Link>
                  <Link
                    href="/participant/digital-twin"
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
                  >
                    Open Digital Twin
                    <ArrowRight aria-hidden="true" className="size-3" />
                  </Link>
                </div>
              </CardFooter>
            </Card>
          </div>

          <section
            aria-labelledby="progress-trends-heading"
            className="space-y-3"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2
                  id="progress-trends-heading"
                  className="text-sm font-semibold text-ink"
                >
                  Trends
                </h2>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  Accuracy and reaction time across comparable scored runs,
                  oldest to newest.
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
                    title="A trend needs at least two scored runs"
                    description="One scored run is recorded. Complete another scored run to compare accuracy and reaction time over time."
                    action={
                      <ButtonLink
                        href="/participant/activities/cpt"
                        size="sm"
                      >
                        Run the CPT again
                      </ButtonLink>
                    }
                  />
                </CardContent>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  );
}
