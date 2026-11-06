import { ArrowRight, BrainCircuit } from "lucide-react";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatDuration } from "@/lib/utils";
import type { ActivitySummary } from "@/types";

const statusConfig: Record<
  ActivitySummary["status"],
  { label: string; tone: BadgeTone }
> = {
  completed: { label: "Completed", tone: "success" },
  "in-progress": { label: "In progress", tone: "brand" },
  "not-started": { label: "Not started", tone: "neutral" },
};

export function ActivityList({
  activities,
}: {
  activities: ActivitySummary[];
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Cognitive activities</CardTitle>
          <CardDescription>
            Synthetic task summaries. Recorded CPT runs appear in activity
            history.
          </CardDescription>
        </div>
        <BrainCircuit
          aria-hidden="true"
          className="size-5 shrink-0 text-brand-600"
        />
      </CardHeader>

      {activities.length === 0 ? (
        <CardContent>
          <EmptyState
            title="No activities yet"
            description="Completed cognitive activities will be listed here with their duration and accuracy context."
          />
        </CardContent>
      ) : (
        <CardContent className="flex-1 space-y-3">
          {activities.map((activity) => {
            const status = statusConfig[activity.status];

            return (
              <div
                key={activity.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-line p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {activity.title}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-subtle">
                    {formatDate(activity.completedAt)} ·{" "}
                    {formatDuration(activity.durationMinutes)}
                    {activity.accuracy !== null
                      ? ` · ${activity.accuracy}% accuracy`
                      : ""}
                  </p>
                </div>
                <Badge tone={status.tone} className="shrink-0">
                  {status.label}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      )}

      <CardFooter className="flex-wrap">
        <p className="text-xs text-ink-subtle">
          Try the demo CPT. Other activities are planned.
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="/participant/activities/history"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
          >
            Activity history
            <ArrowRight aria-hidden="true" className="size-3" />
          </Link>
          <Link
            href="/participant/progress"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
          >
            Progress
            <ArrowRight aria-hidden="true" className="size-3" />
          </Link>
          <Link
            href="/participant/activities"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
          >
            Activity library
            <ArrowRight aria-hidden="true" className="size-3" />
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
