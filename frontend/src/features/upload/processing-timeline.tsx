import { Circle, CircleCheck, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { processingStages } from "@/features/upload/processing-stages";
import { cn } from "@/lib/utils";
import type { ProcessingStageId } from "@/types";

export function ProcessingTimeline({
  completedStageIds,
}: {
  completedStageIds: ProcessingStageId[];
}) {
  const currentStage = processingStages.find(
    (stage) => !completedStageIds.includes(stage.id),
  );

  return (
    <ol className="space-y-0">
      {processingStages.map((stage, index) => {
        const complete = completedStageIds.includes(stage.id);
        const current = !complete && stage.id === currentStage?.id;
        const isLast = index === processingStages.length - 1;

        return (
          <li
            key={stage.id}
            aria-current={current ? "step" : undefined}
            className="relative flex gap-3.5 pb-5 last:pb-0"
          >
            {!isLast ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute bottom-0 left-[11px] top-6 w-px",
                  complete ? "bg-success/30" : "bg-line",
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border",
                complete
                  ? "border-success-line bg-success-soft text-success"
                  : current
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : "border-line bg-surface text-ink-subtle",
              )}
            >
              {complete ? (
                <CircleCheck aria-hidden="true" className="size-4" />
              ) : current ? (
                <Clock3 aria-hidden="true" className="size-3.5" />
              ) : (
                <Circle aria-hidden="true" className="size-3" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={cn(
                    "text-sm font-medium",
                    complete || current ? "text-ink" : "text-ink-muted",
                  )}
                >
                  {stage.label}
                </p>
                {stage.simulated ? (
                  <Badge tone="warning">Simulated</Badge>
                ) : null}
                <span className="sr-only">
                  {complete
                    ? "Complete"
                    : current
                      ? "Current stage"
                      : "Pending"}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-5 text-ink-subtle">
                {stage.description}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
