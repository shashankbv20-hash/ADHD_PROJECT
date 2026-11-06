import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DemoMeta } from "@/types";

type DemoNoticeProps = {
  meta: DemoMeta;
  className?: string;
};

export function DemoNotice({ meta, className }: DemoNoticeProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border border-demo-line bg-demo-soft px-4 py-3.5 sm:flex-row sm:items-start sm:gap-3",
        className,
      )}
    >
      <FlaskConical
        aria-hidden="true"
        className="mt-0.5 hidden size-5 shrink-0 text-demo sm:block"
      />
      <div className="min-w-0 text-sm leading-6">
        <p className="font-semibold text-demo">{meta.label}</p>
        <p className="text-ink-muted">
          {meta.note}{" "}
          <Link
            href="/#research-transparency"
            className="font-medium text-brand-800 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-700"
          >
            Data policy
          </Link>
        </p>
      </div>
    </div>
  );
}
