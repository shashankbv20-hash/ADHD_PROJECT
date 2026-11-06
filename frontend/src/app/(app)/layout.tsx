import { AppShell } from "@/components/layout/app-shell";
import { DataProviderUnavailable } from "@/components/feedback/data-provider-unavailable";
import { ActivitySessionProvider } from "@/features/activities/activity-session-store";
import { DemoPortalGate } from "@/features/demo/demo-portal-gate";
import { FirebaseParticipantGate } from "@/features/firebase/firebase-participant-gate";
import { DemoSessionProvider } from "@/features/upload/demo-session-store";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { getDemoRole } from "@/lib/demo/demo-session-server";

export const instant = false;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = getFrontendConfig();
  const isDemoProvider = config.valid && config.provider === "demo";
  const isFirebaseProvider = config.valid && config.provider === "firebase";
  const providerMode = config.valid ? config.provider : "invalid";
  const configuredDemoRole = await getDemoRole();
  const demoRole =
    config.valid && config.provider === "remote" ? null : configuredDemoRole;
  const demoActive = demoRole !== null;

  return (
    <AppShell
      providerMode={demoActive ? "demo" : providerMode}
      demoRole={demoRole}
    >
      {demoActive ? (
        <DemoSessionProvider key={`demo-sessions-${demoRole}`}>
          <ActivitySessionProvider key={`demo-activity-${demoRole}`}>
            <DemoPortalGate role={demoRole}>{children}</DemoPortalGate>
          </ActivitySessionProvider>
        </DemoSessionProvider>
      ) : isDemoProvider ? (
        <DemoSessionProvider>
          <ActivitySessionProvider>{children}</ActivitySessionProvider>
        </DemoSessionProvider>
      ) : isFirebaseProvider ? (
        <FirebaseParticipantGate>{children}</FirebaseParticipantGate>
      ) : (
        <DataProviderUnavailable config={config} />
      )}
    </AppShell>
  );
}
