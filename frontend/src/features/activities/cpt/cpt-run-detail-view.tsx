"use client";

import {
  ArrowLeft,
  CircleSlash2,
  TrendingUp,
} from "lucide-react";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { participantDemoMeta } from "@/data/demo/participant";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { CptSummary } from "@/features/activities/cpt/cpt-summary";
import { formatDateTime } from "@/lib/utils";

export function CptRunDetailView({ runId }: { runId: string }) {
  const {
    cptRuns,
    storageMode,
    cloudSyncEnabled,
    persistenceStatus,
    persistenceMessage,
  } = useActivitySessions();
  const auth = useFirebaseAuth();
  const isFirebase = storageMode === "firebase";
  const run = cptRuns.find((candidate) => candidate.id === runId);

  if (!run) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Participant workspace"
          title="CPT run unavailable"
          description={
            isFirebase
              ? "This saved or current-browser activity summary is not available to the signed-in account."
              : "This activity record is not present in the current browser session."
          }
          actions={
            <ButtonLink
              href="/participant/activities/history"
              variant="outline"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to history
            </ButtonLink>
          }
        />

        {isFirebase ? null : <DemoNotice meta={participantDemoMeta} />}

        <Card>
          <CardContent className="py-6">
            <EmptyState
              icon={CircleSlash2}
              title={isFirebase ? "Run not found in this account" : "Run not found in memory"}
              description={
                isFirebase
                  ? `No saved or current-browser activity summary matches ${runId} in this authenticated account.`
                  : `The record ${runId} may have been cleared, or the page may have been reloaded. Activity records are not persisted between sessions.`
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <ButtonLink
                    href="/participant/activities/history"
                    variant="outline"
                  >
                    Back to history
                  </ButtonLink>
                  <ButtonLink href="/participant/activities/cpt">
                    Try the CPT
                  </ButtonLink>
                </div>
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
        title="CPT run summary"
        description={
          isFirebase
            ? "Calculated summary metrics from this participant's scored CPT demonstration. Trial-by-trial events are not stored in Firebase."
            : "Calculated metrics and trial-by-trial events from a scored Continuous Performance Task run stored in memory. This is a demo record, not a clinical result."
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success" dot>
              Completed
            </Badge>
            <Badge tone={run.mode === "scored" ? "brand" : "neutral"}>
              {run.mode === "scored" ? "Scored" : "Practice"}
            </Badge>
            <span className="font-mono text-xs text-ink-subtle">
              {run.id}
            </span>
            <span className="text-xs text-ink-subtle">
              {formatDateTime(run.completedAt)} UTC
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink
              href="/participant/activities/history"
              variant="outline"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to history
            </ButtonLink>
            <ButtonLink href="/participant/progress" variant="outline">
              <TrendingUp aria-hidden="true" className="size-4" />
              View progress
            </ButtonLink>
          </>
        }
      />

      {isFirebase ? (
        <Alert tone="info" title="Firebase activity summary">
          {run.events.length < run.trialCount
            ? "This account record contains summary metrics only. Raw trial events and response timelines were not uploaded."
            : cloudSyncEnabled
              ? "This browser run includes trial details locally; Firebase synchronization stores summary fields only."
              : "This run is available in the current browser session. Cloud synchronization is off."}
        </Alert>
      ) : (
        <>
          <DemoNotice meta={participantDemoMeta} />
          <Alert tone="info" title="In-memory record">
            This run remains available until the browser is reloaded or activity
            history is cleared. No activity data is written to browser storage.
          </Alert>
        </>
      )}

      <CptSummary
        title="Continuous Performance Task"
        description={`Scored run completed ${formatDateTime(run.completedAt)} UTC with ${run.trialCount} trials.`}
        mode={run.mode}
        metrics={run}
        events={run.events}
        savedRunId={run.id}
        storageMode={storageMode}
        cloudSyncEnabled={cloudSyncEnabled}
        persistenceStatus={persistenceStatus}
        persistenceMessage={persistenceMessage}
        onSaveReport={
          isFirebase && cloudSyncEnabled
            ? () => auth.saveReportSummary(run)
            : undefined
        }
        actions={
          <ButtonLink href="/participant/activities/cpt" size="sm">
            Run CPT again
          </ButtonLink>
        }
      />
    </div>
  );
}
