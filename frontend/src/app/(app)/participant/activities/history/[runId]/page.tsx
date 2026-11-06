import type { Metadata } from "next";
import { Suspense } from "react";
import { CptRunDetailView } from "@/features/activities/cpt/cpt-run-detail-view";
import { CptRunLoading } from "@/features/activities/cpt/cpt-run-loading";

export const instant = false;

export const metadata: Metadata = {
  title: "CPT run summary",
  description:
    "In-memory Continuous Performance Task run summary with calculated metrics and trial-by-trial events.",
};

async function CptRunDetailContent({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  return <CptRunDetailView runId={runId} />;
}

export default function CptRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  return (
    <Suspense fallback={<CptRunLoading />}>
      <CptRunDetailContent params={params} />
    </Suspense>
  );
}
