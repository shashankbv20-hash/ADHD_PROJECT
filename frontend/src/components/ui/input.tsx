import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const fieldStyles =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-subtle hover:border-slate-400 focus-visible:border-brand-600 aria-invalid:border-danger aria-invalid:bg-danger-soft/40 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-ink-subtle";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldStyles, "h-10", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(fieldStyles, "h-10 pr-8", className)} {...props} />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("text-sm font-medium text-ink", className)}
      {...props}
    />
  );
}

export function FieldHint({
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-xs leading-5 text-ink-subtle", className)}
      {...props}
    />
  );
}

export function FieldError({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      role="alert"
      className={cn("text-xs font-medium leading-5 text-danger", className)}
      {...props}
    />
  );
}
