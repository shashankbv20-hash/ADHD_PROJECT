"use client";

import {
  ArrowLeft,
  ArrowRight,
  FileText,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
import { Progress } from "@/components/ui/progress";
import { participantDemoMeta } from "@/data/demo/participant";
import { useDemoSessions } from "@/features/upload/demo-session-store";
import { MetadataList } from "@/features/upload/metadata-list";
import { MissingDemoSession } from "@/features/upload/missing-demo-session";
import { ProcessingTimeline } from "@/features/upload/processing-timeline";
import { processingStages } from "@/features/upload/processing-stages";
import { UploadStatusBadge } from "@/features/upload/upload-status-badge";
import { formatFileSize } from "@/features/upload/validation";
import { formatDateTime } from "@/lib/utils";

export function ProcessingView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { getSession, advanceStage, cancelSession } = useDemoSessions();
  const session = getSession(sessionId);

  if (!session) {
    return <MissingDemoSession sessionId={sessionId} />;
  }

  const completedCount = session.completedStageIds.length;
  const currentStage = processingStages.find(
    (stage) => !session.completedStageIds.includes(stage.id),
  );
  const complete = session.status === "complete";
  const activeSessionId = session.id;

  function handleCancel() {
    cancelSession(activeSessionId);
    router.push("/participant/upload");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Processing demo session"
        description="Advance a simulated timeline to preview how processing status could appear. No EEG file contents are read and no analysis service is connected."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" dot>
              Demo session
            </Badge>
            <UploadStatusBadge status={session.status} />
            <span className="font-mono text-xs text-ink-subtle">
              {session.id}
            </span>
          </div>
        }
        actions={
          <ButtonLink href="/participant/upload" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to upload
          </ButtonLink>
        }
      />

      <DemoNotice meta={participantDemoMeta} />

      <Alert tone="warning" title="Simulated processing only">
        Analysis services are not connected. No preprocessing, feature
        extraction, or model inference is running. Use the controls below to
        advance the demo timeline manually.
      </Alert>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Demo processing timeline</CardTitle>
            <CardDescription>
              Each stage is a UI state preview. The first two stages were
              completed by client-side checks.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <Progress
              label="Demo stages completed"
              value={completedCount}
              max={processingStages.length}
            />
            <ProcessingTimeline
              completedStageIds={session.completedStageIds}
            />
          </CardContent>

          <CardFooter className="flex-wrap">
            <p aria-live="polite" className="text-xs text-ink-subtle">
              {complete
                ? "Demo walkthrough complete. The session record contains metadata only."
                : currentStage
                  ? `Next stage: ${currentStage.label}`
                  : "All demo stages are complete."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {currentStage ? (
                <Button onClick={() => advanceStage(session.id)}>
                  Mark {currentStage.label} complete
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Button>
              ) : (
                <ButtonLink
                  href={`/participant/sessions/${session.id}`}
                >
                  Open session record
                  <ArrowRight aria-hidden="true" className="size-4" />
                </ButtonLink>
              )}
              <Button
                variant="outline"
                className="text-danger hover:border-danger-line hover:bg-danger-soft"
                onClick={handleCancel}
              >
                Cancel demo upload
              </Button>
            </div>
          </CardFooter>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>File metadata</CardTitle>
              <CardDescription>
                Only metadata is retained in memory for this demo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MetadataList
                items={[
                  { label: "File", value: session.fileName },
                  {
                    label: "Format",
                    value: session.fileExtension.toUpperCase(),
                  },
                  {
                    label: "Size",
                    value: formatFileSize(session.fileSizeBytes),
                  },
                  { label: "Protocol", value: session.protocol },
                  {
                    label: "Uploaded",
                    value: `${formatDateTime(session.uploadedAt)} UTC`,
                  },
                  {
                    label: "Consent",
                    value: "Acknowledged",
                  },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Demo state</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2.5 text-xs leading-5 text-ink-muted">
                <FileText
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-ink-subtle"
                />
                <p>
                  This session lives in memory and resets when the browser is
                  reloaded. No file or result is saved.
                </p>
              </div>
              <ButtonLink
                href="/participant/upload"
                variant="outline"
                className="w-full"
              >
                <UploadCloud aria-hidden="true" className="size-4" />
                Upload another demo file
              </ButtonLink>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
