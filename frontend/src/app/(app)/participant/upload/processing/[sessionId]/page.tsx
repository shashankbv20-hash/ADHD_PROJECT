import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoSessionLoading } from "@/features/upload/demo-session-loading";
import { ProcessingView } from "@/features/upload/processing-view";
import { FirebaseUploadUnavailable } from "@/features/firebase/firebase-upload-unavailable";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { getDemoRole } from "@/lib/demo/demo-session-server";

export const instant = false;

export const metadata: Metadata = {
  title: "Demo processing",
  description:
    "Simulated EEG processing timeline for a metadata-only demo session.",
};

async function ProcessingContent({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const config = getFrontendConfig();
  const demoRole = await getDemoRole();

  if (config.valid && config.provider === "firebase" && !demoRole) {
    return <FirebaseUploadUnavailable sessionId={sessionId} />;
  }

  return <ProcessingView sessionId={sessionId} />;
}

export default function ProcessingPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  return (
    <Suspense fallback={<DemoSessionLoading />}>
      <ProcessingContent params={params} />
    </Suspense>
  );
}
