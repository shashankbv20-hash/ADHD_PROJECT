"use client";

import { ArrowLeft, ArrowRight, Database, History } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import { formatDateTime } from "@/lib/utils";

export function FirebaseSessionHistory() {
  const { account } = useFirebaseAuth();
  const { cptRuns } = useActivitySessions();
  const sessions = account?.appSessions ?? [];
  const savedSessionIds = new Set(sessions.map((session) => session.sessionId));
  const browserOnlyRuns = cptRuns.filter((run) => !savedSessionIds.has(run.id));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Account session history"
        description="CPT application-session metadata saved to your own Firebase account when cloud synchronization was enabled. No EEG upload sessions are created here."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" dot>Firebase account</Badge>
            <span className="text-xs text-ink-subtle">
              {sessions.length} saved application session{sessions.length === 1 ? "" : "s"}
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

      <Alert tone="info" title="Application metadata only">
        These records describe completed CPT demo-task workflows. They do not
        represent EEG recordings, clinical sessions, or server-side analysis.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Saved application sessions</CardTitle>
          <CardDescription>
            Session metadata is stored only after cloud synchronization is
            enabled and a scored CPT run completes.
          </CardDescription>
        </CardHeader>

        {sessions.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={History}
              title="No saved application sessions"
              description="Enable account data synchronization, then complete a scored CPT demo run. Existing in-memory demonstration sessions are not migrated."
              action={
                <ButtonLink href="/participant/digital-twin" variant="outline">
                  Account data settings
                </ButtonLink>
              }
            />
          </CardContent>
        ) : (
          <CardContent className="space-y-3">
            {sessions.map((session) => {
              const run = account?.activityRuns.find(
                (activityRun) => activityRun.id === session.sessionId,
              );

              return (
                <article
                  key={session.sessionId}
                  className="rounded-xl border border-line p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-ink">
                          Continuous Performance Task
                        </h3>
                        <Badge tone="success">Complete</Badge>
                        <Badge tone="outline">Metadata only</Badge>
                      </div>
                      <p className="font-mono text-xs text-ink-subtle">
                        {session.sessionId} · {formatDateTime(session.updatedAt)} UTC
                      </p>
                    </div>
                    {run ? (
                      <ButtonLink
                        href={`/participant/activities/history/${run.id}`}
                        variant="outline"
                        size="sm"
                      >
                        View CPT summary
                        <ArrowRight aria-hidden="true" className="size-3.5" />
                      </ButtonLink>
                    ) : null}
                  </div>
                  <dl className="mt-4 grid gap-3 border-t border-line/70 pt-3 sm:grid-cols-3">
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                        Session type
                      </dt>
                      <dd className="mt-1 text-xs text-ink-muted">{session.sessionType}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                        Scored trials
                      </dt>
                      <dd className="mt-1 font-mono text-xs text-ink-muted">
                        {session.trialCount}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                        Provenance
                      </dt>
                      <dd className="mt-1 text-xs text-ink-muted">
                        Frontend CPT demo
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </CardContent>
        )}

        <CardFooter>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
            <Database aria-hidden="true" className="size-3.5" />
            Owned by the signed-in Firebase UID
          </span>
          <Link
            href="/participant/activities/history"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
          >
            Activity history
            <ArrowRight aria-hidden="true" className="size-3" />
          </Link>
        </CardFooter>
      </Card>

      {browserOnlyRuns.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Current browser CPT runs</CardTitle>
            <CardDescription>
              These scored runs are available in memory but are not saved to
              Firestore. Turning sync on does not migrate earlier runs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {browserOnlyRuns.map((run) => (
              <article
                key={run.id}
                className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-mono text-xs font-medium text-ink">
                    {run.id}
                  </p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    {formatDateTime(run.completedAt)} UTC · {run.trialCount} CPT trials · browser only
                  </p>
                </div>
                <ButtonLink
                  href={`/participant/activities/history/${run.id}`}
                  variant="outline"
                  size="sm"
                >
                  View run summary
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </ButtonLink>
              </article>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
