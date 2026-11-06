import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { ClinicianRosterStatus } from "@/types";

export const clinicianRosterStatusConfig: Record<
  ClinicianRosterStatus,
  { label: string; tone: BadgeTone }
> = {
  "on-track": { label: "On track", tone: "success" },
  "review-needed": { label: "Review needed", tone: "warning" },
  new: { label: "New", tone: "brand" },
};

export function ClinicianStatusBadge({
  status,
}: {
  status: ClinicianRosterStatus;
}) {
  const config = clinicianRosterStatusConfig[status];

  return <Badge tone={config.tone}>{config.label}</Badge>;
}
