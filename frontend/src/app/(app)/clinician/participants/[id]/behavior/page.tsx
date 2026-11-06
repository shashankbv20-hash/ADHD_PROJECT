import type { Metadata } from "next";
import { Suspense } from "react";
import { ClinicianBehavioralSummary } from "@/features/clinician/clinician-behavioral-summary";
import { ClinicianParticipantLoading } from "@/features/clinician/clinician-participant-loading";
import { ClinicianParticipantNotFound } from "@/features/clinician/clinician-participant-not-found";
import { demoClinicianService } from "@/lib/services/demo/clinician-service";
import { loadDemoService } from "@/lib/services/service-provider";

export const instant = false;

export const metadata: Metadata = {
  title: "Behavioral activity summary",
  description:
    "Descriptive clinician CPT activity summary calculated from linked in-memory trial events.",
};

async function BehaviorContent({
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
    <ClinicianBehavioralSummary
      participant={participant}
      meta={overview.meta}
    />
  );
}

export default function ClinicianBehaviorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <ClinicianParticipantLoading label="Loading behavioral summary" />
      }
    >
      <BehaviorContent params={params} />
    </Suspense>
  );
}
