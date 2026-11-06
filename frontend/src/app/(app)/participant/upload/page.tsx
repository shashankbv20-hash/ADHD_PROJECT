import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { participantDemoMeta } from "@/data/demo/participant";
import { UploadForm } from "@/features/upload/upload-form";
import { FirebaseUploadUnavailable } from "@/features/firebase/firebase-upload-unavailable";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { getDemoRole } from "@/lib/demo/demo-session-server";

export const metadata: Metadata = {
  title: "Upload EEG",
  description:
    "Demo EEG upload with client-side file checks and a simulated processing walkthrough.",
};

export default async function UploadPage() {
  const config = getFrontendConfig();
  const demoRole = await getDemoRole();

  if (config.valid && config.provider === "firebase" && !demoRole) {
    return <FirebaseUploadUnavailable />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Upload an EEG recording"
        description="Choose a synthetic file to preview the upload, validation, and processing interfaces. The file is never read, uploaded, or stored."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" dot>
              Demo upload
            </Badge>
            <span className="text-xs text-ink-subtle">
              Client-side checks only - no analysis service connected
            </span>
          </div>
        }
        actions={
          <ButtonLink href="/participant" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to overview
          </ButtonLink>
        }
      />

      <DemoNotice meta={participantDemoMeta} />

      <UploadForm />
    </div>
  );
}
