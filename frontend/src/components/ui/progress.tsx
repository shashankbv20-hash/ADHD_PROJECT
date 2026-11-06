import { clamp, cn } from "@/lib/utils";

type ProgressProps = {
  value: number;
  max?: number;
  label: string;
  showValue?: boolean;
  className?: string;
  barClassName?: string;
};

export function Progress({
  value,
  max = 100,
  label,
  showValue = true,
  className,
  barClassName,
}: ProgressProps) {
  const percent = clamp((value / max) * 100, 0, 100);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-muted">{label}</span>
        {showValue ? (
          <span className="font-mono text-xs font-medium text-ink">
            {value}
            <span className="text-ink-subtle">/{max}</span>
          </span>
        ) : null}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className={cn("h-full rounded-full bg-brand-600", barClassName)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
