import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { SessionStatus } from "@/types";

const statusConfig: Record<
  SessionStatus,
  { label: string; tone: BadgeTone }
> = {
  analyzed: { label: "Analyzed", tone: "success" },
  processing: { label: "Processing", tone: "brand" },
  "needs-review": { label: "Needs review", tone: "warning" },
  failed: { label: "Upload failed", tone: "danger" },
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const config = statusConfig[status];

  return (
    <Badge tone={config.tone} dot>
      {config.label}
    </Badge>
  );
}
