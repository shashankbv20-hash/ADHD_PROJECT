import { Badge, type BadgeTone } from "@/components/ui/badge";

export function ClinicianDetailRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-line/70 py-3 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {detail ? (
          <p className="mt-0.5 text-xs leading-5 text-ink-subtle">{detail}</p>
        ) : null}
      </div>
      <span className="shrink-0 font-mono text-xs font-medium text-ink-muted">
        {value}
      </span>
    </div>
  );
}

export function ClinicianAvailabilityRow({
  label,
  status,
  tone,
  description,
}: {
  label: string;
  status: string;
  tone: BadgeTone;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-line/70 py-3 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-ink-subtle">
          {description}
        </p>
      </div>
      <Badge tone={tone} className="shrink-0">
        {status}
      </Badge>
    </div>
  );
}
