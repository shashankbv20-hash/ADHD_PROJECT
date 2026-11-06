import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "outline";

const toneStyles: Record<BadgeTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  brand: "border-brand-200 bg-brand-50 text-brand-800",
  accent: "border-accent-line bg-accent-soft text-accent",
  success: "border-success-line bg-success-soft text-success",
  warning: "border-demo-line bg-demo-soft text-demo",
  danger: "border-danger-line bg-danger-soft text-danger",
  outline: "border-line-strong bg-transparent text-ink-muted",
};

const dotStyles: Record<BadgeTone, string> = {
  neutral: "bg-slate-400",
  brand: "bg-brand-500",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-demo",
  danger: "bg-danger",
  outline: "bg-ink-subtle",
};

type BadgeProps = ComponentProps<"span"> & {
  tone?: BadgeTone;
  dot?: boolean;
};

export function Badge({
  className,
  tone = "neutral",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5",
        toneStyles[tone],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", dotStyles[tone])}
        />
      ) : null}
      {children}
    </span>
  );
}
