import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function ResearchMetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="p-5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <Icon aria-hidden="true" className="size-[18px]" />
      </span>
      <dt className="mt-4 text-xs font-medium text-ink-subtle">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-semibold tracking-tight text-ink">
        {value}
      </dd>
      <dd className="mt-1 text-xs leading-5 text-ink-subtle">{detail}</dd>
    </Card>
  );
}
