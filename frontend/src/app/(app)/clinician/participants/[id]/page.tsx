import type { Metadata } from "next";
import { Suspense } from "react";
import { ClinicianParticipantLoading } from "@/features/clinician/clinician-participant-loading";
import { ClinicianParticipantNotFound } from "@/features/clinician/clinician-participant-not-found";
import { ClinicianParticipantOverview } from "@/features/clinician/clinician-participant-overview";
import { demoClinicianService } from "@/lib/services/demo/clinician-service";
import { loadDemoService } from "@/lib/services/service-provider";

export const instant = false;

export const metadata: Metadata = {
  title: "Participant overview",
  description:
    "Synthetic clinician participant overview with linked in-memory CPT context and explicit unavailable EEG and model states.",
};

async function ParticipantContent({
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
    <ClinicianParticipantOverview
      participant={participant}
      meta={overview.meta}
    />
  );
}

export default function ClinicianParticipantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ClinicianParticipantLoading />}>
      <ParticipantContent params={params} />
    </Suspense>
  );
}
