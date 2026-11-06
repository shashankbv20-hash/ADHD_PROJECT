import type { Metadata } from "next";
import {
  ArrowLeft,
  CircleCheck,
  Clock3,
  History,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SessionHistory } from "@/features/sessions/session-history";
import { DemoUploadsList } from "@/features/upload/demo-uploads-list";
import {
  DEMO_PARTICIPANT_ID,
  participantDemoMeta,
} from "@/data/demo/participant";
import { demoParticipantService } from "@/lib/services/demo/participant-service";
import { loadDemoService } from "@/lib/services/service-provider";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { getDemoRole } from "@/lib/demo/demo-session-server";
import { FirebaseSessionHistory } from "@/features/firebase/firebase-session-history";

export const metadata: Metadata = {
  title: "Session history",
  description:
    "Demonstration EEG session history with status filters, signal quality, and illustrative focus index values.",
};

const summaryIcons: Record<string, LucideIcon> = {
  total: History,
  analyzed: CircleCheck,
  attention: Clock3,
};

export default async function SessionsPage() {
  const config = getFrontendConfig();
  const demoRole = await getDemoRole();

  if (config.valid && config.provider === "firebase" && !demoRole) {
    return <FirebaseSessionHistory />;
  }

  const result = await loadDemoService(
    () => demoParticipantService.listSessions(DEMO_PARTICIPANT_ID),
    "participant",
  );

  if (!result.available) {
    return null;
  }

  const sessions = result.data;

  const analyzedCount = sessions.filter(
    (session) => session.status === "analyzed",
  ).length;
  const attentionCount = sessions.filter(
    (session) =>
      session.status === "needs-review" || session.status === "processing",
  ).length;

  const summary = [
    {
      id: "total",
      label: "Preloaded sessions",
      value: String(sessions.length),
      description:
        "Preloaded synthetic records in this demonstration workspace.",
    },
    {
      id: "analyzed",
      label: "Analyzed",
      value: String(analyzedCount),
      description: "Completed demonstration analysis records.",
    },
    {
      id: "attention",
      label: "Needs attention",
      value: String(attentionCount),
      description: "Processing or flagged for review. No analysis is running.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Session history"
        description="Browse synthetic EEG recordings and their current interface status. No real recording or analysis service is connected."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" dot>
              Demo participant
            </Badge>
            <span className="text-xs text-ink-subtle">
              ATN-0142 · {sessions.length} synthetic sessions
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink href="/participant/upload">
              <UploadCloud aria-hidden="true" className="size-4" />
              Upload demo EEG
            </ButtonLink>
            <ButtonLink href="/participant" variant="outline">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to overview
            </ButtonLink>
          </>
        }
      />

      <DemoNotice meta={participantDemoMeta} />

      <div className="grid gap-4 sm:grid-cols-3">
        {summary.map((item) => {
          const Icon = summaryIcons[item.id] ?? History;

          return (
            <Card key={item.id} className="p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon aria-hidden="true" className="size-[18px]" />
                </span>
                <p className="text-sm font-medium text-ink-muted">
                  {item.label}
                </p>
              </div>
              <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-ink">
                {item.value}
              </p>
              <p className="mt-1 text-xs leading-5 text-ink-subtle">
                {item.description}
              </p>
            </Card>
          );
        })}
      </div>

      <DemoUploadsList />

      <SessionHistory sessions={sessions} />

      <Alert tone="info" title="Session detail is available for demo uploads">
        Files added through the demo upload flow can be opened as
        metadata-only session records. Preloaded synthetic sessions remain
        inventory-only because they have no in-memory workflow record.
      </Alert>
    </div>
  );
}
