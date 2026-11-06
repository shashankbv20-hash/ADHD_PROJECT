import type { Metadata } from "next";
import { Suspense } from "react";
import { ClinicianParticipantLoading } from "@/features/clinician/clinician-participant-loading";
import { ClinicianParticipantNotFound } from "@/features/clinician/clinician-participant-not-found";
import { ClinicianResearchReport } from "@/features/clinician/clinician-research-report";
import { demoClinicianService } from "@/lib/services/demo/clinician-service";
import { loadDemoService } from "@/lib/services/service-provider";

export const instant = false;

export const metadata: Metadata = {
  title: "Research report",
  description:
    "Browser-printable clinician research summary limited to synthetic roster context and descriptive in-memory CPT data.",
};

async function ReportContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadDemoService(
    () =>
      Promise.all([
        demoClinicianService.getOverview(),
        demoClinicianService.getParticipant(id),
      ]),
    "clinician",
  );

  if (!result.available) {
    return null;
  }

  const [overview, participant] = result.data;

  if (!participant) {
    return <ClinicianParticipantNotFound participantId={id} />;
  }

  return (
    <ClinicianResearchReport participant={participant} meta={overview.meta} />
  );
}

export default function ClinicianReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={<ClinicianParticipantLoading label="Loading research report" />}
    >
      <ReportContent params={params} />
    </Suspense>
  );
}
