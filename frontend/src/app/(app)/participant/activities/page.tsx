import type { Metadata } from "next";
import {
  ArrowLeft,
  CircleX,
  ListChecks,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { participantDemoMeta } from "@/data/demo/participant";
import { ActivityLibrary } from "@/features/activities/activity-library";
import { RecentCptRuns } from "@/features/activities/recent-cpt-runs";
import { activityService } from "@/lib/services/activity-service";
import { demoActivityService } from "@/lib/services/demo/activity-service";
import { loadDemoService } from "@/lib/services/service-provider";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { getDemoRole } from "@/lib/demo/demo-session-server";
import { FirebaseActivityLibrary } from "@/features/firebase/firebase-activity-library";

export const metadata: Metadata = {
  title: "Cognitive activities",
  description:
    "Demo cognitive activity library with one interactive Continuous Performance Task and five planned activities.",
};

const cptRecords = [
  {
    title: "Target detection",
    description:
      "Hits and misses for the target letter X, recorded once per scored trial.",
    icon: Target,
  },
  {
    title: "Response control",
    description:
      "False alarms and correct rejections for letters that are not the target.",
    icon: CircleX,
  },
  {
    title: "Reaction time",
    description:
      "Mean reaction time for correct detections with a valid response timestamp.",
    icon: Timer,
  },
];

export default async function ActivitiesPage() {
  const config = getFrontendConfig();
  const demoRole = await getDemoRole();

  if (config.valid && config.provider === "firebase" && !demoRole) {
    const activities = await activityService.listActivities();
    return <FirebaseActivityLibrary activities={activities} />;
  }

  const result = await loadDemoService(
    () => demoActivityService.listActivities(),
    "participant",
  );

  if (!result.available) {
    return null;
  }

  const activities = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Cognitive activities"
        description="Try short attention and memory exercises designed for the demo participant. The library is a frontend prototype, not a clinical assessment battery."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" dot>
              Demo activities
            </Badge>
            <span className="text-xs text-ink-subtle">
              Interactive tasks · in-memory results
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink
              href="/participant/activities/history"
              variant="outline"
            >
              <ListChecks aria-hidden="true" className="size-4" />
              Activity history
            </ButtonLink>
            <ButtonLink href="/participant/progress" variant="outline">
              <TrendingUp aria-hidden="true" className="size-4" />
              Progress
            </ButtonLink>
            <ButtonLink href="/participant" variant="outline">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to overview
            </ButtonLink>
          </>
        }
      />

      <DemoNotice meta={participantDemoMeta} />

      <Alert tone="info" title="Eleven activities are ready to try">
        Every card marked Available starts a short practice, then a scored run.
        Cards marked Planned do not start a task yet. These are demonstration
        tasks, not clinical assessments.
      </Alert>

      <ActivityLibrary activities={activities} />

      <RecentCptRuns />

      <Card>
        <CardHeader>
          <CardTitle>What the CPT records</CardTitle>
          <CardDescription>
            The demo task keeps a trial-by-trial event log and calculates simple
            descriptive metrics in the browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {cptRecords.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="rounded-lg border border-line p-4">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon aria-hidden="true" className="size-[18px]" />
                </span>
                <p className="mt-3 text-sm font-medium text-ink">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-ink-subtle">
                  {item.description}
                </p>
              </div>
            );
          })}
        </CardContent>
        <CardFooter>
          <p className="text-xs leading-5 text-ink-subtle">
            Results are demonstration data only and reset when the browser is
            reloaded.
          </p>
          <Badge tone="warning">Not clinical</Badge>
        </CardFooter>
      </Card>
    </div>
  );
}
