import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { UploadSessionStatus } from "@/types";

const statusConfig: Record<
  UploadSessionStatus,
  { label: string; tone: BadgeTone }
> = {
  processing: { label: "Demo processing", tone: "brand" },
  complete: { label: "Ready for review", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

export function UploadStatusBadge({
  status,
}: {
  status: UploadSessionStatus;
}) {
  const config = statusConfig[status];

  return (
    <Badge tone={config.tone} dot>
      {config.label}
    </Badge>
  );
}
