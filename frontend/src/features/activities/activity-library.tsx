import {
  ArrowRight,
  Clock3,
  Crosshair,
  Eye,
  Gamepad2,
  Grid3x3,
  Hand,
  OctagonX,
  Palette,
  Orbit,
  Puzzle,
  Search,
  Shuffle,
  Timer,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";
import type {
  CognitiveActivityDefinition,
  CognitiveActivityId,
} from "@/types";

const activityIcons: Record<CognitiveActivityId, LucideIcon> = {
  cpt: Crosshair,
  "go-no-go": Hand,
  "stop-signal": OctagonX,
  stroop: Palette,
  "task-switching": Shuffle,
  "visual-search": Search,
  "planning-puzzle": Puzzle,
  "selective-attention": Eye,
  "n-back": Layers,
  "visual-sequence": Grid3x3,
  "time-perception": Timer,
  "multiple-object-tracking": Orbit,
  "focus-arena": Gamepad2,
};

export function ActivityLibrary({
  activities,
}: {
  activities: CognitiveActivityDefinition[];
}) {
  const availableCount = activities.filter(
    (activity) => activity.availability === "available",
  ).length;

  return (
    <section aria-labelledby="activity-library-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="activity-library-heading"
            className="text-sm font-semibold text-ink"
          >
            Activity library
          </h2>
          <p className="mt-0.5 text-xs text-ink-subtle">
            Six short cognitive activities. Only the CPT is interactive in this
            milestone.
          </p>
        </div>
        <span className="text-xs text-ink-subtle">
          {availableCount} available · {activities.length - availableCount}{" "}
          planned
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {activities.map((activity) => {
          const Icon = activityIcons[activity.id];
          const available =
            activity.availability === "available" && Boolean(activity.href);

          return (
            <Card key={activity.id} className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                {available ? (
                  <Badge tone="brand" dot>
                    Available
                  </Badge>
                ) : (
                  <Badge tone="neutral">Planned</Badge>
                )}
              </CardHeader>

              <CardContent className="flex-1 space-y-2">
                <h3 className="text-base font-semibold tracking-tight text-ink">
                  {activity.title}
                </h3>
                <CardDescription>{activity.description}</CardDescription>
                <p className="flex items-center gap-1.5 pt-1 text-xs text-ink-subtle">
                  <Clock3 aria-hidden="true" className="size-3.5" />
                  {activity.estimatedDurationMinutes
                    ? `About ${formatDuration(
                        activity.estimatedDurationMinutes,
                      )}`
                    : "Duration to be confirmed"}
                </p>
              </CardContent>

              <CardFooter>
                {available && activity.href ? (
                  <ButtonLink href={activity.href} size="sm">
                    Start activity
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </ButtonLink>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-line bg-slate-50 px-3 text-sm font-medium text-ink-subtle"
                  >
                    Coming soon
                  </span>
                )}
                <span className="text-xs text-ink-subtle">
                  {activity.availability === "available"
                    ? "Demo activity"
                    : "Not built yet"}
                </span>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
