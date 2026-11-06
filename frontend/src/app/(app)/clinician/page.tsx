import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  GitCompare,
  History,
  ScanLine,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
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
import { EmptyState } from "@/components/ui/empty-state";
import { buildClinicianDashboardSummary } from "@/features/clinician/clinician-data";
import { ClinicianStatusBadge } from "@/features/clinician/clinician-status";
import { demoClinicianService } from "@/lib/services/demo/clinician-service";
import { loadDemoService } from "@/lib/services/service-provider";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Clinician overview",
  description:
    "Demonstration clinician workspace with a synthetic participant roster, derived counts, and review queue.",
};

const summaryIcons: Record<string, LucideIcon> = {
  participants: Users,
  "review-queue": ScanLine,
  sessions: History,
};

export default async function ClinicianPage() {
  const result = await loadDemoService(
    () => demoClinicianService.getOverview(),
    "clinician",
  );

  if (!result.available) {
    return null;
  }

  const overview = result.data;
  const dashboardSummary = buildClinicianDashboardSummary(overview);

  const summary = [
    {
      id: "participants",
      label: "Active participants",
      value: String(dashboardSummary.participantCount),
      description:
        "Synthetic participant records in this demonstration roster.",
    },
    {
      id: "review-queue",
      label: "Sessions awaiting review",
      value: String(dashboardSummary.reviewQueueCount),
      description:
        "Demo review-queue entries. No review action is connected.",
    },
    {
      id: "sessions",
      label: "Recorded sessions",
      value: String(dashboardSummary.recordedSessionCount),
      description:
        "Sum of session counts in the synthetic roster summary.",
    },
  ];

  const participantIdByResearchCode = new Map(
    overview.roster.map((participant) => [
      participant.researchCode,
      participant.id,
    ]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinician workspace"
        title="Clinician overview"
        description="A demonstration review workspace for synthetic participant records, roster summaries, and a pending review queue."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning" dot>
              Demonstration roster
            </Badge>
            <span className="text-xs text-ink-subtle">
              {overview.roster.length} synthetic participant
              {overview.roster.length === 1 ? "" : "s"} · no real records
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink href="/clinician/participants">
              <Users aria-hidden="true" className="size-4" />
              Participant roster
            </ButtonLink>
            <ButtonLink href="/clinician/compare" variant="outline">
              <GitCompare aria-hidden="true" className="size-4" />
              Session comparison
            </ButtonLink>
            <ButtonLink href="/participant" variant="outline">
              View participant demo
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </>
        }
      />

      <DemoNotice meta={overview.meta} />

      <Alert tone="info" title="Clinician capabilities are interface-only">
        Roster search, participant overviews, EEG availability, behavioral
        summaries, session comparison, and printable research reports are
        available. EEG visualization is illustrative only; no real EEG signal is
        connected. Session review actions, cohort reporting, model inference,
        and production authorization are not available. No real participant data
        is present in this prototype.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-3">
        {summary.map((stat) => {
          const Icon = summaryIcons[stat.id] ?? Users;

          return (
            <Card key={stat.id} className="p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon aria-hidden="true" className="size-[18px]" />
                </span>
                <p className="text-sm font-medium text-ink-muted">
                  {stat.label}
                </p>
              </div>
              <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-ink">
                {stat.value}
              </p>
              <p className="mt-1 text-xs leading-5 text-ink-subtle">
                {stat.description}
              </p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Participant roster</CardTitle>
              <CardDescription>
                Synthetic caseload preview.{" "}
                {dashboardSummary.reviewNeededCount} participant
                {dashboardSummary.reviewNeededCount === 1 ? "" : "s"} marked for
                review. Open a participant to review the available
                demonstration context.
              </CardDescription>
            </div>
            <ButtonLink
              href="/clinician/participants"
              variant="outline"
              size="sm"
            >
              Full roster
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </ButtonLink>
          </CardHeader>

          {overview.roster.length === 0 ? (
            <CardContent>
              <EmptyState
                icon={Users}
                title="No participant records"
                description="The synthetic clinician roster is empty. No participant totals or activity summaries are inferred."
              />
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">
                  Demonstration clinician participant roster with synthetic
                  session summaries and roster status.
                </caption>
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-subtle">
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Participant
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Last session
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Sessions
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Quality
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      <span className="sr-only">Participant overview</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.roster.map((participant) => (
                    <tr
                      key={participant.id}
                      className="border-b border-line/70 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/clinician/participants/${participant.id}`}
                          className="flex items-center gap-2.5 rounded-md"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-800 ring-1 ring-inset ring-brand-100">
                            {participant.initials}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">
                              {participant.displayName}
                            </p>
                            <p className="font-mono text-[10px] text-ink-subtle">
                              {participant.researchCode} ·{" "}
                              {participant.ageBand}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-muted">
                        {formatDate(participant.lastSessionAt)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-muted">
                        {participant.sessionCount}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-muted">
                        {participant.signalQuality}%
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <ClinicianStatusBadge status={participant.status} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <ButtonLink
                          href={`/clinician/participants/${participant.id}`}
                          variant="outline"
                          size="sm"
                          aria-label={`Open overview for ${participant.displayName}`}
                        >
                          Open
                          <ArrowRight
                            aria-hidden="true"
                            className="size-3.5"
                          />
                        </ButtonLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <CardFooter className="flex-wrap">
            <p className="text-xs text-ink-subtle">
              Showing all {overview.roster.length} synthetic participant
              {overview.roster.length === 1 ? "" : "s"}.
            </p>
            <Link
              href="/clinician/participants"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
            >
              Open searchable roster
              <ArrowRight aria-hidden="true" className="size-3" />
            </Link>
          </CardFooter>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Review queue</CardTitle>
              <CardDescription>
                Demonstration sessions flagged for attention.
              </CardDescription>
            </div>
            <Badge tone="warning">
              {overview.reviewQueue.length} open
            </Badge>
          </CardHeader>

          {overview.reviewQueue.length === 0 ? (
            <CardContent className="flex-1">
              <EmptyState
                icon={ScanLine}
                title="No sessions awaiting review"
                description="The synthetic review queue is empty. No review totals are inferred."
              />
            </CardContent>
          ) : (
            <div className="flex-1 space-y-3 p-5">
              {overview.reviewQueue.map((item) => {
                const participantId = participantIdByResearchCode.get(
                  item.researchCode,
                );

                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-line p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {participantId ? (
                          <Link
                            href={`/clinician/participants/${participantId}`}
                            className="truncate text-sm font-medium text-ink hover:text-brand-800"
                          >
                            {item.participantName}
                          </Link>
                        ) : (
                          <p className="truncate text-sm font-medium text-ink">
                            {item.participantName}
                          </p>
                        )}
                        <p className="font-mono text-[10px] text-ink-subtle">
                          {item.researchCode} · {item.sessionId}
                        </p>
                      </div>
                      <Badge
                        tone={
                          item.priority === "priority" ? "danger" : "neutral"
                        }
                      >
                        {item.priority === "priority" ? "Priority" : "Routine"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-ink-muted">
                      {item.reason}
                    </p>
                    <p className="mt-1.5 text-[10px] text-ink-subtle">
                      Submitted {formatDate(item.submittedAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <CardFooter>
            <p className="text-xs text-ink-subtle">
              Review actions are not connected.
            </p>
            <span className="text-xs text-ink-subtle">Demo</span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
