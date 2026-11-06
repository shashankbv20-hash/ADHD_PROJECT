import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type InfoTooltipProps = {
  label: string;
  className?: string;
};

export function InfoTooltip({ label, className }: InfoTooltipProps) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex size-5 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-slate-100 hover:text-brand-700"
      >
        <Info aria-hidden="true" className="size-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-60 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs font-normal leading-5 text-white opacity-0 shadow-raised transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
