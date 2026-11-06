import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoSessionLoading } from "@/features/upload/demo-session-loading";
import { SessionDetailView } from "@/features/sessions/session-detail-view";
import { FirebaseSessionDetail } from "@/features/firebase/firebase-session-detail";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { getDemoRole } from "@/lib/demo/demo-session-server";

export const instant = false;

export const metadata: Metadata = {
  title: "Session record",
  description:
    "Metadata-only demo session record with explicit unavailable analysis states.",
};

async function SessionDetailContent({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const config = getFrontendConfig();
  const demoRole = await getDemoRole();

  if (config.valid && config.provider === "firebase" && !demoRole) {
    return <FirebaseSessionDetail sessionId={sessionId} />;
  }

  return <SessionDetailView sessionId={sessionId} />;
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  return (
    <Suspense fallback={<DemoSessionLoading />}>
      <SessionDetailContent params={params} />
    </Suspense>
  );
}
