import { FileQuestion } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function MissingDemoSession({ sessionId }: { sessionId: string }) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Demo session not found"
        description="This in-memory demo session is no longer available. It may have been cancelled, or the page was reloaded and the demo state was reset."
        meta={
          <span className="font-mono text-xs text-ink-subtle">
            {sessionId || "Unknown session"}
          </span>
        }
        actions={
          <ButtonLink href="/participant/upload">Upload a demo file</ButtonLink>
        }
      />

      <Alert tone="warning" title="Demo state is in memory only">
        Uploaded file metadata and processing progress are not persisted.
        Reloading the browser starts a fresh demo session.
      </Alert>

      <Card>
        <CardContent>
          <EmptyState
            icon={FileQuestion}
            title="No demo session record"
            description="Start a new demo upload to preview the processing timeline and the metadata-only session record."
            action={
              <div className="flex flex-wrap justify-center gap-2.5">
                <ButtonLink href="/participant/upload">
                  Upload demo EEG
                </ButtonLink>
                <ButtonLink
                  href="/participant/sessions"
                  variant="outline"
                >
                  Session history
                </ButtonLink>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
