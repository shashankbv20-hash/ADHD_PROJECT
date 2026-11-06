import type { Metadata } from "next";
import { Suspense } from "react";
import { ClinicianEegView } from "@/features/clinician/clinician-eeg-view";
import { ClinicianParticipantLoading } from "@/features/clinician/clinician-participant-loading";
import { ClinicianParticipantNotFound } from "@/features/clinician/clinician-participant-not-found";
import { demoClinicianService } from "@/lib/services/demo/clinician-service";
import { loadDemoService } from "@/lib/services/service-provider";

export const instant = false;

export const metadata: Metadata = {
  title: "EEG analysis",
  description:
    "Clinician EEG availability view with explicit unavailable recording states and a separately labelled illustrative visualization.",
};

async function EegContent({ params }: { params: Promise<{ id: string }> }) {
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
    <ClinicianEegView participant={participant} meta={overview.meta} />
  );
}

export default function ClinicianEegPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={<ClinicianParticipantLoading label="Loading EEG analysis" />}
    >
      <EegContent params={params} />
    </Suspense>
  );
}
