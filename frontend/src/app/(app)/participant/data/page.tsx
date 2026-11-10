import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataPrivacyView } from "@/features/backend/data-privacy-view";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { getDemoRole } from "@/lib/demo/demo-session-server";

export const metadata: Metadata = {
  title: "Data & privacy",
  description:
    "Download or erase the research data stored about you, review the access log, and manage research consent.",
};

export default async function DataPrivacyPage() {
  const config = getFrontendConfig();
  const demoRole = await getDemoRole();

  // These controls act on the research backend, which exists only in API-backed mode.
  if (config.valid && config.provider === "firebase" && config.apiBaseUrl && !demoRole) {
    return <DataPrivacyView />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data &amp; privacy controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert tone="info" title="Not connected to the research backend">
          Download, erase and the access log are available when the app is connected to the research
          backend with a signed-in account. In this mode nothing is saved to a backend: demonstration
          data lives only in this browser tab and is cleared when you reload.
        </Alert>
        <ButtonLink href="/participant" variant="outline">
          Back to overview
        </ButtonLink>
      </CardContent>
    </Card>
  );
}
