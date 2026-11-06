import type { Metadata } from "next";
import { ClinicianSessionComparison } from "@/features/clinician/clinician-session-comparison";
import { demoClinicianService } from "@/lib/services/demo/clinician-service";
import { loadDemoService } from "@/lib/services/service-provider";

export const metadata: Metadata = {
  title: "Session comparison",
  description:
    "Compare eligible scored CPT runs from the same synthetic participant using in-memory trial events.",
};

export default async function ClinicianComparePage() {
  const result = await loadDemoService(
    () => demoClinicianService.getOverview(),
    "clinician",
  );

  if (!result.available) {
    return null;
  }

  const overview = result.data;

  return (
    <ClinicianSessionComparison
      participants={overview.roster}
      meta={overview.meta}
    />
  );
}
