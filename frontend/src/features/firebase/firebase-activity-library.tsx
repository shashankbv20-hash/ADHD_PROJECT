"use client";

import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ActivityLibrary } from "@/features/activities/activity-library";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import { RecentCptRuns } from "@/features/activities/recent-cpt-runs";
import type { CognitiveActivityDefinition } from "@/types";

export function FirebaseActivityLibrary({
  activities,
}: {
  activities: CognitiveActivityDefinition[];
}) {
  const { persistenceTarget } = useActivitySessions();
  const toBackend = persistenceTarget === "backend";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Cognitive activities"
        description="The CPT remains a frontend demonstration task. Scored summaries can be saved to your Firebase account only when cloud synchronization is enabled."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning" dot>Demonstration task</Badge>
            <span className="text-xs text-ink-subtle">No clinical interpretation</span>
          </div>
        }
        actions={
          <ButtonLink href="/participant" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Account overview
          </ButtonLink>
        }
      />

      <Alert
        tone="info"
        title={
          toBackend
            ? "Scored runs are saved only with your research consent"
            : "Firebase stores summaries only when you opt in"
        }
      >
        {toBackend
          ? "Authentication and the participant profile are separate from research data collection. With research consent, scored runs (including trial events) are sent to the research backend; practice runs and EEG files are never uploaded."
          : "Authentication and the participant profile are separate from optional activity synchronization. Raw trial events, response timelines, and EEG files are not uploaded."}
      </Alert>

      <ActivityLibrary activities={activities} />
      <RecentCptRuns />
    </div>
  );
}
