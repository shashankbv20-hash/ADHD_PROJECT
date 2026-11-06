import { ArrowLeft, Database, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function FirebaseUploadUnavailable({
  sessionId,
}: {
  sessionId?: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title={sessionId ? "EEG session unavailable" : "EEG upload unavailable"}
        description="Firebase participant mode does not upload or process EEG recordings. The existing upload walkthrough remains available only in demo mode."
        actions={
          <ButtonLink href="/participant" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Account overview
          </ButtonLink>
        }
      />

      <Alert tone="warning" title="No EEG file was uploaded">
        The Firebase integration stores no EEG files or raw signals. A configured
        Firebase account does not enable EEG parsing, preprocessing, or analysis.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {sessionId ? <Database aria-hidden="true" className="size-5" /> : <UploadCloud aria-hidden="true" className="size-5" />}
            {sessionId ? "No matching Firebase application session" : "Demo upload workflow"}
          </CardTitle>
          <CardDescription>
            {sessionId
              ? `No saved CPT application session matches ${sessionId}. EEG upload sessions are not created in Firebase mode.`
              : "Choose the demo provider to use the local metadata-only upload walkthrough. It does not send file contents."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <ButtonLink href="/participant/sessions" variant="outline">
            View account sessions
          </ButtonLink>
          <ButtonLink href="/participant/activities/cpt">
            Open the CPT demo
          </ButtonLink>
        </CardContent>
      </Card>
    </div>
  );
}
