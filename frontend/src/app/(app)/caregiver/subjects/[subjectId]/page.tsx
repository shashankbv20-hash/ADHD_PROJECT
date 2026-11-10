import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CaregiverSubjectView } from "@/features/caregiver/caregiver-views";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { getDemoRole } from "@/lib/demo/demo-session-server";

export const instant = false;

export const metadata: Metadata = {
  title: "Shared participant",
  description: "Read-only progress shared with a caregiver.",
};

async function SubjectContent({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const config = getFrontendConfig();
  const demoRole = await getDemoRole();

  if (config.valid && config.provider === "firebase" && config.apiBaseUrl && !demoRole) {
    return <CaregiverSubjectView subjectId={subjectId} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Caregiver access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert tone="info" title="Not connected to the research backend">
          Caregiver access needs the research backend and a signed-in caregiver account.
        </Alert>
        <ButtonLink href="/caregiver" variant="outline">
          Back
        </ButtonLink>
      </CardContent>
    </Card>
  );
}

export default function CaregiverSubjectPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-ink-subtle">
          Loading…
        </p>
      }
    >
      <SubjectContent params={params} />
    </Suspense>
  );
}
