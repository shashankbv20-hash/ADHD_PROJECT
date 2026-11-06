"use client";

import { ArrowRight, Database, Fingerprint, ListChecks, LogOut, Target, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CloudSyncSettings } from "@/features/firebase/cloud-sync-settings";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import { formatDateTime } from "@/lib/utils";

function AccountMetric({
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

export function FirebaseParticipantDashboard() {
  const { account, signOutUser } = useFirebaseAuth();
  const { cptRuns, persistenceMessage, persistenceStatus } = useActivitySessions();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  if (!account) {
    return null;
  }

  const latestRun = cptRuns[0] ?? null;
  const persistedRunCount = account.activityRuns.length;
  const syncLabel = account.profile.cloudSyncEnabled ? "Enabled" : "Off";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title={`Welcome, ${account.profile.displayName}`}
        description="Your authenticated participant account and optional saved CPT summaries. This frontend does not provide EEG analysis, clinical interpretation, or staff access."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success" dot>Firebase account</Badge>
            <Badge tone="outline">Participant</Badge>
            <span className="text-xs text-ink-subtle">
              Cloud sync {syncLabel.toLowerCase()}
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink href="/participant/activities/cpt">
              <Target aria-hidden="true" className="size-4" />
              Open the CPT demo
            </ButtonLink>
            <ButtonLink href="/participant/sessions" variant="outline">
              <Database aria-hidden="true" className="size-4" />
              Account sessions
            </ButtonLink>
            <Button
              variant="ghost"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                setSignOutError(null);
                void signOutUser()
                  .catch((error: unknown) => {
                    setSignOutError(
                      error instanceof Error
                        ? error.message
                        : "Sign-out could not be completed.",
                    );
                  })
                  .finally(() => setSigningOut(false));
              }}
            >
              <LogOut aria-hidden="true" className="size-4" />
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </>
        }
      />

      {signOutError ? (
        <Alert tone="danger" title="Sign-out failed">
          {signOutError}
        </Alert>
      ) : null}

      <Alert tone="info" title="Participant account data only">
        This workspace shows your authenticated profile and CPT demo records.
        There are no EEG recordings, signal measurements, diagnoses, model
        predictions, clinician permissions, or researcher permissions connected
        to this account.
      </Alert>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AccountMetric
          icon={Fingerprint}
          label="Account role"
          value="Participant"
          detail="Public registration cannot assign staff roles."
        />
        <AccountMetric
          icon={ListChecks}
          label="Saved CPT summaries"
          value={String(persistedRunCount)}
          detail="Only summaries saved with cloud sync enabled."
        />
        <AccountMetric
          icon={Database}
          label="Saved CPT sessions"
          value={String(account.appSessions.length)}
          detail="CPT workflow metadata only; no EEG files."
        />
        <AccountMetric
          icon={Target}
          label="Latest available run"
          value={latestRun ? `${latestRun.trialCount} trials` : "—"}
          detail={
            latestRun
              ? `${latestRun.accuracyPercent ?? "—"}% accuracy; CPT demo result.`
              : "Complete a scored CPT run to see a summary."
          }
        />
      </dl>

      {persistenceStatus === "saving" ? (
        <Alert tone="info" title="Saving activity summary">
          The CPT summary and application-session metadata are being saved. Raw
          trial events and EEG contents are not uploaded.
        </Alert>
      ) : null}
      {persistenceStatus === "failed" ? (
        <Alert tone="danger" title="Cloud synchronization failed">
          {persistenceMessage ?? "This run remains only in the current browser session."}
        </Alert>
      ) : null}
      {persistenceStatus === "saved" && persistenceMessage ? (
        <Alert tone="success" title="Activity summary saved">
          {persistenceMessage}
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <CloudSyncSettings />

        <Card>
          <CardHeader>
            <CardTitle>Supported participant data</CardTitle>
            <CardDescription>
              Data connected to this Firebase account in this integration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-3 border-b border-line py-3 first:pt-0">
              <div>
                <p className="text-sm font-medium text-ink">Participant profile</p>
                <p className="mt-0.5 text-xs leading-5 text-ink-subtle">
                  UID-owned profile, participant role, and sync preference.
                </p>
              </div>
              <Badge tone="success">Stored</Badge>
            </div>
            <div className="flex items-start justify-between gap-3 border-b border-line py-3">
              <div>
                <p className="text-sm font-medium text-ink">CPT summaries</p>
                <p className="mt-0.5 text-xs leading-5 text-ink-subtle">
                  Summary counts and metrics only when cloud sync is on.
                </p>
              </div>
              <Badge tone={account.profile.cloudSyncEnabled ? "brand" : "outline"}>
                {account.profile.cloudSyncEnabled ? "Opted in" : "Not syncing"}
              </Badge>
            </div>
            <div className="flex items-start justify-between gap-3 py-3 last:pb-0">
              <div>
                <p className="text-sm font-medium text-ink">EEG and staff data</p>
                <p className="mt-0.5 text-xs leading-5 text-ink-subtle">
                  No raw EEG, clinician roster, or researcher records are available.
                </p>
              </div>
              <Badge tone="outline">Unavailable</Badge>
            </div>
          </CardContent>
          <div className="flex justify-end px-5 pb-4">
            <ButtonLink href="/participant/digital-twin" variant="outline" size="sm">
              View Digital Twin summary
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </ButtonLink>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saved report summaries</CardTitle>
          <CardDescription>
            Saved only after you explicitly choose “Save report summary” while
            cloud synchronization is enabled.
          </CardDescription>
        </CardHeader>
        {account.reports.length === 0 ? (
          <CardContent>
            <p className="text-sm leading-6 text-ink-muted">
              No report summaries have been saved to this account.
            </p>
          </CardContent>
        ) : (
          <CardContent className="space-y-3">
            {account.reports.map((report) => (
              <article
                key={report.reportId}
                className="flex flex-col gap-3 rounded-lg border border-line p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    CPT summary · {report.runId}
                  </p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    Saved {formatDateTime(report.createdAt)} UTC · {report.trialCount} trials · accuracy {report.accuracyPercent ?? "—"}%
                  </p>
                </div>
                <ButtonLink
                  href={`/participant/activities/history/${report.runId}`}
                  variant="outline"
                  size="sm"
                >
                  View saved summary
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </ButtonLink>
              </article>
            ))}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account profile</CardTitle>
          <CardDescription>
            Participant-owned Firebase profile. No staff role or research code is
            assigned by public registration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-subtle">
                Display name
              </dt>
              <dd className="mt-1 text-sm text-ink">{account.profile.displayName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-subtle">
                Firebase UID
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-ink-muted">
                {account.profile.uid}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-subtle">
                Profile updated
              </dt>
              <dd className="mt-1 text-sm text-ink">
                {account.profile.updatedAt
                  ? `${formatDateTime(account.profile.updatedAt)} UTC`
                  : "Timestamp unavailable"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-subtle">
                Cloud synchronization
              </dt>
              <dd className="mt-1 text-sm text-ink">{syncLabel}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
