import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CaregiverOverview } from "@/features/caregiver/caregiver-views";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { getDemoRole } from "@/lib/demo/demo-session-server";

export const metadata: Metadata = {
  title: "Caregiver",
  description: "Read-only progress shared with a caregiver by a participant.",
};

export default async function CaregiverPage() {
  const config = getFrontendConfig();
  const demoRole = await getDemoRole();

  // Caregiver access is a real, consented relationship held by the research backend.
  if (config.valid && config.provider === "firebase" && config.apiBaseUrl && !demoRole) {
    return <CaregiverOverview />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Caregiver access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert tone="info" title="Not connected to the research backend">
          Caregiver access needs the research backend and a signed-in caregiver account. There is no
          demonstration caregiver, because sharing is a real choice made by a participant.
        </Alert>
        <ButtonLink href="/login" variant="outline">
          Go to sign in
        </ButtonLink>
      </CardContent>
    </Card>
  );
}
