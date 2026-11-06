"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonStyles } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Workspace route failed to render.", {
      name: error.name,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 text-center shadow-card">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
          <CircleAlert aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-ink">
          This view could not be loaded
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-muted">
          Something went wrong while rendering the workspace. No data was
          changed. You can retry the view or return to the overview.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-ink-subtle">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <Button onClick={reset}>
            <RotateCcw aria-hidden="true" className="size-4" />
            Try again
          </Button>
          <Link
            href="/participant"
            className={buttonStyles({ variant: "outline" })}
          >
            Back to overview
          </Link>
        </div>
      </div>
    </div>
  );
}
