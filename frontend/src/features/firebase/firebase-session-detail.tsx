"use client";

import { ArrowLeft, CircleSlash2, Database } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { formatDateTime } from "@/lib/utils";

export function FirebaseSessionDetail({ sessionId }: { sessionId: string }) {
  const { account } = useFirebaseAuth();
  const session = account?.appSessions.find(
    (appSession) => appSession.sessionId === sessionId,
  );

  if (!session) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Participant workspace"
          title="Application session unavailable"
          description="No saved CPT application-session metadata matches this identifier."
          actions={
            <ButtonLink href="/participant/sessions" variant="outline">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Account sessions
            </ButtonLink>
          }
        />
        <Card>
          <CardContent className="py-6">
            <EmptyState
              icon={CircleSlash2}
              title="Session not found in this account"
              description="This view only reads records owned by the signed-in Firebase UID. It does not substitute demo EEG sessions."
              action={
                <ButtonLink href="/participant/sessions">
                  Back to account sessions
                </ButtonLink>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="CPT application session"
        description="Saved application metadata for a completed frontend CPT demonstration. This is not an EEG recording or analysis session."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">Complete</Badge>
            <Badge tone="outline">Summary metadata only</Badge>
            <span className="font-mono text-xs text-ink-subtle">{session.sessionId}</span>
          </div>
        }
        actions={
          <ButtonLink href="/participant/sessions" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Account sessions
          </ButtonLink>
        }
      />

      <Alert tone="warning" title="No raw trial or EEG data stored">
        The summary record contains permitted counts and task metadata only. Raw
        CPT event timelines and all EEG files/signals remain outside Firestore.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Stored session metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-subtle">Activity</dt>
              <dd className="mt-1 text-sm text-ink">{session.activityId}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-subtle">Trial count</dt>
              <dd className="mt-1 font-mono text-sm text-ink">{session.trialCount}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-subtle">Created</dt>
              <dd className="mt-1 text-sm text-ink">{formatDateTime(session.createdAt)} UTC</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.08em] text-ink-subtle">Updated</dt>
              <dd className="mt-1 text-sm text-ink">{formatDateTime(session.updatedAt)} UTC</dd>
            </div>
          </dl>
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-line bg-slate-50 p-3 text-xs leading-5 text-ink-subtle">
            <Database aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Owner is determined from the authenticated Firebase UID, not a
            client-supplied participant identifier.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
