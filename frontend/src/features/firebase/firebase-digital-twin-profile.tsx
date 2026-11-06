"use client";

import { Activity, ArrowLeft, CircleSlash2, Gauge, Target, Timer, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import { CptProgressCharts } from "@/features/activities/cpt/cpt-progress-charts";
import { buildDigitalTwinProfile } from "@/features/digital-twin/digital-twin-profile-data";
import { CloudSyncSettings } from "@/features/firebase/cloud-sync-settings";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { formatDateTime } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

function ProfileMetric({
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

export function FirebaseDigitalTwinProfile() {
  const { account } = useFirebaseAuth();
  const { cptRuns } = useActivitySessions();

  if (!account) {
    return null;
  }

  const profile = buildDigitalTwinProfile(cptRuns);
  const persistedSnapshot = account.digitalTwin;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Digital Twin research profile"
        description="A descriptive profile derived from this participant account's scored CPT summaries. This is not a learned model, brain simulation, diagnosis, or clinical assessment."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent" dot>Derived CPT profile</Badge>
            <Badge tone={account.profile.cloudSyncEnabled ? "brand" : "outline"}>
              {account.profile.cloudSyncEnabled ? "Cloud sync on" : "Cloud sync off"}
            </Badge>
            <span className="text-xs text-ink-subtle">
              {profile.scoredRuns.length} scored run{profile.scoredRuns.length === 1 ? "" : "s"}
            </span>
          </div>
        }
        actions={
          <ButtonLink href="/participant" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Account overview
          </ButtonLink>
        }
      />

      <Alert tone="warning" title="No EEG-derived or predictive profile data">
        This profile uses frontend CPT measurements only. It does not include
        EEG features, model inference, clinical classifications, or treatment
        recommendations. Firebase stores no raw trial timelines.
      </Alert>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <CloudSyncSettings />
        <Card>
          <CardHeader>
            <CardTitle>Persisted profile snapshot</CardTitle>
            <CardDescription>
              Saved when cloud sync is enabled and a scored CPT summary is stored.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {persistedSnapshot ? (
              <div className="space-y-2">
                <Badge tone="success">Saved</Badge>
                <p className="text-sm text-ink">
                  {persistedSnapshot.sourceRunCount} source run
                  {persistedSnapshot.sourceRunCount === 1 ? "" : "s"} · updated{" "}
                  {formatDateTime(persistedSnapshot.updatedAt)} UTC
                </p>
                <p className="text-xs leading-5 text-ink-subtle">
                  The snapshot records provenance, source-run IDs, and supported
                  CPT summary values only.
                </p>
              </div>
            ) : (
              <p className="text-sm leading-6 text-ink-muted">
                No Digital Twin snapshot has been saved. Enable cloud sync before
                future scored runs; existing browser-only runs are not migrated.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {profile.scoredRuns.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <EmptyState
              icon={Activity}
              title="No scored CPT summaries available"
              description="Complete a scored CPT demonstration to derive a profile. No EEG, model, or clinical values are invented."
              action={
                <ButtonLink href="/participant/activities/cpt">
                  Open the CPT demo
                </ButtonLink>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ProfileMetric
              icon={Gauge}
              label="Aggregate accuracy"
              value={profile.aggregate.accuracyPercent === null ? "—" : `${profile.aggregate.accuracyPercent}%`}
              detail="Correct detections and correct rejections."
            />
            <ProfileMetric
              icon={Target}
              label="Target detections"
              value={`${profile.aggregate.hitCount}/${profile.aggregate.targetCount}`}
              detail={`${profile.aggregate.missCount} missed targets. Descriptive only.`}
            />
            <ProfileMetric
              icon={CircleSlash2}
              label="False alarms"
              value={String(profile.aggregate.falseAlarmCount)}
              detail={`${profile.aggregate.correctRejectionCount} correct rejections.`}
            />
            <ProfileMetric
              icon={Timer}
              label="Mean hit reaction time"
              value={profile.aggregate.meanHitReactionTimeMs === null ? "—" : `${profile.aggregate.meanHitReactionTimeMs} ms`}
              detail="Derived from available valid hit responses."
            />
            <ProfileMetric
              icon={Activity}
              label="Scored runs"
              value={String(profile.scoredRuns.length)}
              detail="Saved Firebase summaries and this browser's current runs."
            />
            <ProfileMetric
              icon={CircleSlash2}
              label="Full trial logs"
              value={String(profile.completeTrialLogCount)}
              detail="Firebase summary records omit raw trial events."
            />
          </dl>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Baseline reference</CardTitle>
                <CardDescription>
                  The earliest scored run among currently available summaries.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.baselineRun ? (
                  <>
                    <p className="font-mono text-xs text-ink-subtle">
                      {profile.baselineRun.id} · {formatDateTime(profile.baselineRun.completedAt)} UTC
                    </p>
                    <p className="text-sm leading-6 text-ink-muted">
                      This is a frontend reference convention, not a clinical
                      baseline. Clearing local history or changing stored runs
                      can change the reference.
                    </p>
                    {profile.baselineComparison ? (
                      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-slate-50/60 p-3">
                        <div>
                          <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">Accuracy difference</dt>
                          <dd className="mt-1 font-mono text-sm text-ink">
                            {profile.baselineComparison.accuracyDelta === null ? "—" : `${profile.baselineComparison.accuracyDelta > 0 ? "+" : ""}${profile.baselineComparison.accuracyDelta} pts`}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">Mean hit RT difference</dt>
                          <dd className="mt-1 font-mono text-sm text-ink">
                            {profile.baselineComparison.reactionTimeDelta === null ? "—" : `${profile.baselineComparison.reactionTimeDelta > 0 ? "+" : ""}${profile.baselineComparison.reactionTimeDelta} ms`}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="text-xs text-ink-subtle">
                        Two scored runs are required to calculate a descriptive difference.
                      </p>
                    )}
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stored-data limitations</CardTitle>
                <CardDescription>
                  What this Firebase profile includes and omits.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-ink-muted">
                <p>Only summary metrics and source-run identifiers can be persisted.</p>
                <p>Raw CPT trial events, response timing sequences, and EEG contents are not uploaded.</p>
                <p>When sync is off, new runs remain in memory and reset on reload.</p>
                <p>Turning sync off stops future writes but does not delete saved Firestore records.</p>
              </CardContent>
            </Card>
          </div>

          <section aria-labelledby="firebase-twin-trends" className="space-y-3">
            <div>
              <h2 id="firebase-twin-trends" className="text-sm font-semibold text-ink">
                CPT summary trends
              </h2>
              <p className="mt-0.5 text-xs text-ink-subtle">
                Uses the same shared CPT summary and progress calculations.
              </p>
            </div>
            {profile.hasTrend ? (
              <CptProgressCharts data={profile.trendPoints} />
            ) : (
              <Card>
                <CardContent className="py-6">
                  <EmptyState
                    icon={TrendingUp}
                    title="Two scored runs are needed for a trend"
                    description="No trend is inferred from a single or missing observation."
                    action={<ButtonLink href="/participant/activities/cpt">Run the CPT demo</ButtonLink>}
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
