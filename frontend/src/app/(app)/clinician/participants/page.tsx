import type { Metadata } from "next";
import { ClinicianParticipantRoster } from "@/features/clinician/clinician-participant-roster";
import { demoClinicianService } from "@/lib/services/demo/clinician-service";
import { loadDemoService } from "@/lib/services/service-provider";

export const metadata: Metadata = {
  title: "Participants",
  description:
    "Searchable synthetic clinician participant roster with roster summaries and linked in-memory CPT context.",
};

export default async function ClinicianParticipantsPage() {
  const result = await loadDemoService(
    () => demoClinicianService.getOverview(),
    "clinician",
  );

  if (!result.available) {
    return null;
  }

  const overview = result.data;

  return (
    <ClinicianParticipantRoster
      participants={overview.roster}
      meta={overview.meta}
    />
  );
}
