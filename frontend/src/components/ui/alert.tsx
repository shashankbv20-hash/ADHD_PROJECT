import {
  CircleCheck,
  CircleX,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AlertTone = "info" | "success" | "warning" | "danger";

const toneStyles: Record<
  AlertTone,
  { container: string; icon: string; title: string }
> = {
  info: {
    container: "border-brand-200 bg-brand-50/80",
    icon: "text-brand-700",
    title: "text-brand-950",
  },
  success: {
    container: "border-success-line bg-success-soft",
    icon: "text-success",
    title: "text-success",
  },
  warning: {
    container: "border-demo-line bg-demo-soft",
    icon: "text-demo",
    title: "text-demo",
  },
  danger: {
    container: "border-danger-line bg-danger-soft",
    icon: "text-danger",
    title: "text-danger",
  },
};

const toneIcons: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
};

type AlertProps = {
  tone?: AlertTone;
  title: string;
  children?: ReactNode;
  className?: string;
  icon?: LucideIcon;
} & Omit<ComponentProps<"div">, "title" | "children">;

export function Alert({
  tone = "info",
  title,
  children,
  className,
  icon,
  ...props
}: AlertProps) {
  const Icon = icon ?? toneIcons[tone];
  const styles = toneStyles[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3.5",
        styles.container,
        className,
      )}
      {...props}
    >
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-5 shrink-0", styles.icon)}
      />
      <div className="min-w-0 space-y-1">
        <p className={cn("text-sm font-semibold", styles.title)}>{title}</p>
        {children ? (
          <div className="text-sm leading-6 text-ink-muted">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
