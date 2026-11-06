"use client";

import {
  ArrowLeft,
  CircleSlash2,
  UploadCloud,
} from "lucide-react";
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
import { participantDemoMeta } from "@/data/demo/participant";
import { useDemoSessions } from "@/features/upload/demo-session-store";
import { MetadataList } from "@/features/upload/metadata-list";
import { MissingDemoSession } from "@/features/upload/missing-demo-session";
import { ProcessingTimeline } from "@/features/upload/processing-timeline";
import { UploadStatusBadge } from "@/features/upload/upload-status-badge";
import { formatFileSize } from "@/features/upload/validation";
import { formatDateTime } from "@/lib/utils";

function AnalysisRow({
  label,
  status,
  description,
}: {
  label: string;
  status: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/70 py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-ink-subtle">
          {description}
        </p>
      </div>
      <Badge tone="outline" className="shrink-0">
        {status}
      </Badge>
    </div>
  );
}

export function SessionDetailView({ sessionId }: { sessionId: string }) {
  const { getSession } = useDemoSessions();
  const session = getSession(sessionId);

  if (!session) {
    return <MissingDemoSession sessionId={sessionId} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Demo session record"
        description="This record contains client-side file metadata and a simulated processing timeline. No EEG signal, quality score, artifact flag, feature summary, or model output was produced."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <UploadStatusBadge status={session.status} />
            <Badge tone="outline">Metadata only</Badge>
            <span className="font-mono text-xs text-ink-subtle">
              {session.id}
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink
              href="/participant/sessions"
              variant="outline"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Session history
            </ButtonLink>
            <ButtonLink href="/participant/upload">
              <UploadCloud aria-hidden="true" className="size-4" />
              Upload another
            </ButtonLink>
          </>
        }
      />

      <DemoNotice meta={participantDemoMeta} />

      <Alert tone="warning" title="Analysis is not connected">
        A real session record would require upload storage, signal quality
        assessment, artifact detection, feature extraction, and model
        inference. None of those services are part of this frontend prototype.
      </Alert>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Session metadata</CardTitle>
            <CardDescription>
              Retained in memory for this browser session only.
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
                  value: `${formatDateTime(session.consentAcceptedAt)} UTC`,
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analysis summary</CardTitle>
            <CardDescription>
              These interface states intentionally show what is unavailable
              rather than inventing measurements.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnalysisRow
              label="Signal quality"
              status="Not assessed"
              description="No signal was read, so quality cannot be calculated."
            />
            <AnalysisRow
              label="Artifact flags"
              status="Not assessed"
              description="No artifact detection ran on the selected file."
            />
            <AnalysisRow
              label="Feature summary"
              status="Not generated"
              description="No spectral, connectivity, or behavioral features were extracted."
            />
            <AnalysisRow
              label="Model output"
              status="Not available"
              description="No classification, probability, or clinical finding was generated."
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Processing timeline</CardTitle>
          <CardDescription>
            Simulated stages completed during the demo walkthrough.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProcessingTimeline
            completedStageIds={session.completedStageIds}
          />
        </CardContent>
        <CardFooter>
          <p className="text-xs text-ink-subtle">
            Session records are synthetic demo data.
          </p>
          <span className="text-xs text-ink-subtle">In-memory only</span>
        </CardFooter>
      </Card>

      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-slate-50/60 px-4 py-3.5 text-xs leading-5 text-ink-muted">
        <CircleSlash2
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-ink-subtle"
        />
        <p>
          Reloading the browser clears this record. Start another demo upload
          to recreate the walkthrough. No file or result is saved between
          visits.
        </p>
      </div>
    </div>
  );
}
