import type { Metadata } from "next";
import { ArrowRight, History, UploadCloud } from "lucide-react";
import { Suspense } from "react";
import { ActivityList } from "@/features/activities/activity-list";
import { WeeklyConsistency } from "@/features/activities/weekly-consistency";
import { DigitalTwinSummary } from "@/features/digital-twin/digital-twin-summary";
import { RecentSessionsTable } from "@/features/sessions/recent-sessions-table";
import { BandPowerChart } from "@/components/charts/band-power-chart";
import { FocusTrendChart } from "@/components/charts/focus-trend-chart";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { DEMO_PARTICIPANT_ID } from "@/data/demo/participant";
import { FirebaseParticipantDashboard } from "@/features/firebase/firebase-participant-dashboard";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { demoParticipantService } from "@/lib/services/demo/participant-service";
import { getDemoRole } from "@/lib/demo/demo-session-server";
import { loadDemoService } from "@/lib/services/service-provider";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Participant overview",
  description:
    "Demonstration participant dashboard for EEG sessions, cognitive activities, and a synthetic Digital Twin profile.",
};

// The Firebase auth gate intentionally withholds this page until the client
// confirms the signed-in user's profile; Next cannot validate the dropped
// segment while that protected subtree is withheld.
export const instant = false;

function ParticipantDashboardLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-6"
    >
      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">
          Participant workspace
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Loading your participant overview…
        </p>
      </div>
      <div
        aria-hidden="true"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border border-line bg-surface"
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="grid gap-4 xl:grid-cols-[1.55fr_1fr]"
      >
        <div className="h-72 animate-pulse rounded-xl border border-line bg-surface" />
        <div className="h-72 animate-pulse rounded-xl border border-line bg-surface" />
      </div>
    </div>
  );
}

export default function ParticipantPage() {
  return (
    <Suspense fallback={<ParticipantDashboardLoading />}>
      <ParticipantPageContent />
    </Suspense>
  );
}

async function ParticipantPageContent() {
  const config = getFrontendConfig();
  const demoRole = await getDemoRole();

  if (config.valid && config.provider === "firebase" && !demoRole) {
    return <FirebaseParticipantDashboard />;
  }

  const result = await loadDemoService(
    () => demoParticipantService.getDashboard(DEMO_PARTICIPANT_ID),
    "participant",
  );

  if (!result.available) {
    return null;
  }

  const dashboard = result.data;
  const {
    participant,
    stats,
    focusTrend,
    bandPower,
    recentSessions,
    twinTraits,
    activities,
    weeklyConsistency,
    meta,
  } = dashboard;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title={`Welcome back, ${participant.displayName.split(" ")[0]}`}
        description="Review recent EEG sessions, cognitive activities, and the demonstration Digital Twin profile. Every value on this page is synthetic."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" dot>
              Demo participant
            </Badge>
            <span className="text-xs text-ink-subtle">
              Research code {participant.researchCode} · Snapshot{" "}
              {formatDate(meta.snapshotDate)}
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink href="/participant/upload">
              <UploadCloud aria-hidden="true" className="size-4" />
              Upload EEG
            </ButtonLink>
            <ButtonLink href="/participant/sessions" variant="outline">
              <History aria-hidden="true" className="size-4" />
              Review sessions
              <ArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </>
        }
      />

      <DemoNotice meta={meta} />

      <section aria-labelledby="metrics-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="metrics-heading"
              className="text-sm font-semibold text-ink"
            >
              Key metrics
            </h2>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Illustrative summary values from synthetic session records.
            </p>
          </div>
          <span className="font-mono text-[11px] text-ink-subtle">
            demo snapshot
          </span>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.id} stat={stat} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Focus index trend</CardTitle>
              <CardDescription>
                Eight synthetic sessions, latest at the right.
              </CardDescription>
            </div>
            <Badge tone="brand">8 sessions</Badge>
          </CardHeader>
          <CardContent>
            <figure>
              <FocusTrendChart data={focusTrend} />
              <figcaption className="mt-2 text-xs leading-5 text-ink-subtle">
                Illustrative composite from synthetic session summaries. Not a
                validated clinical measure.
              </figcaption>
            </figure>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Relative band power</CardTitle>
              <CardDescription>
                Illustrative composition of a synthetic session.
              </CardDescription>
            </div>
            <Badge tone="warning">Demo</Badge>
          </CardHeader>
          <CardContent>
            <figure>
              <BandPowerChart data={bandPower} />
              <figcaption className="mt-2 text-xs leading-5 text-ink-subtle">
                Percentages are placeholder values, not derived from a real EEG
                recording.
              </figcaption>
            </figure>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <RecentSessionsTable sessions={recentSessions} />
        <DigitalTwinSummary
          traits={twinTraits}
          participantName={participant.displayName}
          initials={participant.initials}
          researchCode={participant.researchCode}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WeeklyConsistency data={weeklyConsistency} />
        <ActivityList activities={activities} />
      </div>
    </div>
  );
}
