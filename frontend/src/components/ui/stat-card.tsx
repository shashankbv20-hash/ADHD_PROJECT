import {
  Activity,
  BrainCircuit,
  Minus,
  ScanLine,
  Target,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DashboardStat, DashboardStatId } from "@/types";

const statIcons: Record<DashboardStatId, LucideIcon> = {
  sessions: ScanLine,
  "signal-quality": Activity,
  "focus-index": Target,
  activities: BrainCircuit,
};

const deltaIcons = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
} as const;

export function StatCard({ stat }: { stat: DashboardStat }) {
  const Icon = statIcons[stat.id];
  const DeltaIcon = deltaIcons[stat.deltaDirection];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Icon aria-hidden="true" className="size-[18px]" />
          </span>
          <span className="truncate text-sm font-medium text-ink-muted">
            {stat.label}
          </span>
        </div>
        <InfoTooltip label={stat.description} />
      </div>
      <p className="mt-4 font-mono text-3xl font-semibold tracking-tight text-ink">
        {stat.value}
        {stat.unit ? (
          <span className="ml-0.5 text-base font-medium text-ink-subtle">
            {stat.unit}
          </span>
        ) : null}
      </p>
      <p
        className={cn(
          "mt-1.5 flex flex-wrap items-center gap-1.5 text-xs",
          stat.deltaDirection === "up" ? "text-brand-700" : "text-ink-subtle",
        )}
      >
        <DeltaIcon aria-hidden="true" className="size-3.5" />
        <span>{stat.delta}</span>
        <span aria-hidden="true" className="text-line-strong">
          ·
        </span>
        <span className="text-ink-subtle">demo</span>
      </p>
    </Card>
  );
}
