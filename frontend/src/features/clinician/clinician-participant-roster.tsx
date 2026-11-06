"use client";

import {
  ArrowLeft,
  ArrowRight,
  Search,
  SearchX,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { DEMO_PARTICIPANT_ID } from "@/data/demo/participant";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import {
  ClinicianStatusBadge,
  clinicianRosterStatusConfig,
} from "@/features/clinician/clinician-status";
import { cn, formatDate } from "@/lib/utils";
import type {
  ClinicianParticipant,
  ClinicianRosterStatus,
  DemoMeta,
} from "@/types";

type StatusFilter = "all" | ClinicianRosterStatus;

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "on-track", label: "On track" },
  { value: "review-needed", label: "Review needed" },
  { value: "new", label: "New" },
];

function ParticipantIdentity({
  participant,
  asHeading = false,
}: {
  participant: ClinicianParticipant;
  asHeading?: boolean;
}) {
  const NameTag = asHeading ? "h3" : "p";

  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-800 ring-1 ring-inset ring-brand-100">
        {participant.initials}
      </span>
      <div className="min-w-0">
        <NameTag className="truncate text-sm font-medium text-ink">
          {participant.displayName}
        </NameTag>
        <p className="font-mono text-[10px] text-ink-subtle">
          {participant.researchCode} · {participant.ageBand}
        </p>
      </div>
    </div>
  );
}

function LinkedRunValue({
  count,
  available,
}: {
  count: number;
  available: boolean;
}) {
  if (!available) {
    return <span className="text-xs text-ink-subtle">Not linked</span>;
  }

  return (
    <span className="font-mono text-xs text-ink-muted">
      {count} linked
    </span>
  );
}

export function ClinicianParticipantRoster({
  participants,
  meta,
}: {
  participants: ClinicianParticipant[];
  meta: DemoMeta;
}) {
  const { cptRuns } = useActivitySessions();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const normalizedQuery = query.trim().toLowerCase();

  const runCountByParticipant = useMemo(() => {
    const counts = new Map<string, number>();

    for (const run of cptRuns) {
      if (run.mode !== "scored") {
        continue;
      }

      counts.set(run.participantId, (counts.get(run.participantId) ?? 0) + 1);
    }

    return counts;
  }, [cptRuns]);

  const filteredParticipants = useMemo(
    () =>
      participants.filter((participant) => {
        const matchesStatus =
          statusFilter === "all" || participant.status === statusFilter;
        const matchesQuery =
          !normalizedQuery ||
          [
            participant.id,
            participant.displayName,
            participant.researchCode,
            participant.ageBand,
            clinicianRosterStatusConfig[participant.status].label,
          ].some((value) => value.toLowerCase().includes(normalizedQuery));

        return matchesStatus && matchesQuery;
      }),
    [normalizedQuery, participants, statusFilter],
  );

  const countFor = (value: StatusFilter) =>
    value === "all"
      ? participants.length
      : participants.filter(
          (participant) => participant.status === value,
        ).length;

  function resetFilters() {
    setStatusFilter("all");
    setQuery("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinician workspace"
        title="Participants"
        description="Search the synthetic clinician roster and open a participant overview. Only records and measurements supported by the demonstration data are shown."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-demo-line bg-demo-soft px-2.5 py-0.5 text-xs font-medium leading-5 text-demo">
              <Users aria-hidden="true" className="size-3.5" />
              {participants.length} synthetic participant
              {participants.length === 1 ? "" : "s"}
            </span>
            <span className="text-xs text-ink-subtle">
              No real participant records
            </span>
          </div>
        }
        actions={
          <ButtonLink href="/clinician" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Clinician overview
          </ButtonLink>
        }
      />

      <DemoNotice meta={meta} />

      <Alert tone="info" title="Roster scope">
        Session counts and signal-quality values are preloaded synthetic roster
        summaries. CPT run counts are calculated from scored runs currently held
        in memory and linked by participant ID.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Participant roster</CardTitle>
          <CardDescription>
            Search by name, research code, age band, or status. Open a
            participant to review the available demonstration context.
          </CardDescription>
        </CardHeader>

        {participants.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Users}
              title="No participant records"
              description="The synthetic clinician roster is empty. No participant totals or activity summaries are inferred."
              action={
                <ButtonLink href="/clinician" variant="outline">
                  Back to clinician overview
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div
                role="group"
                aria-label="Filter participants by roster status"
                className="flex flex-wrap gap-1.5"
              >
                {statusFilters.map((option) => {
                  const active = statusFilter === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStatusFilter(option.value)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-ink bg-ink text-white"
                          : "border-line bg-surface text-ink-muted hover:border-line-strong hover:bg-slate-50",
                      )}
                    >
                      {option.label}
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none",
                          active
                            ? "bg-white/15 text-white"
                            : "bg-slate-100 text-ink-subtle",
                        )}
                      >
                        {countFor(option.value)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="w-full lg:w-72">
                <label htmlFor="participant-search" className="sr-only">
                  Search participants by name, research code, age band, or
                  status
                </label>
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
                  />
                  <Input
                    id="participant-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search participants"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {filteredParticipants.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={SearchX}
                  title="No matching participants"
                  description="No synthetic participants match the current search and status filter. Adjust the query or clear the filters."
                  action={
                    <Button variant="outline" onClick={resetFilters}>
                      Clear filters
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <caption className="sr-only">
                      Synthetic clinician participant roster with roster
                      summaries and linked in-memory CPT run counts.
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
                          Signal quality
                        </th>
                        <th scope="col" className="px-5 py-2.5 font-medium">
                          CPT runs
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
                      {filteredParticipants.map((participant) => {
                        const linkedCount =
                          runCountByParticipant.get(participant.id) ?? 0;
                        const activityAvailable =
                          participant.id === DEMO_PARTICIPANT_ID ||
                          linkedCount > 0;

                        return (
                          <tr
                            key={participant.id}
                            className="border-b border-line/70 last:border-0 hover:bg-slate-50/60"
                          >
                            <td className="px-5 py-3">
                              <Link
                                href={`/clinician/participants/${participant.id}`}
                                className="block rounded-md"
                              >
                                <ParticipantIdentity participant={participant} />
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
                              <LinkedRunValue
                                count={linkedCount}
                                available={activityAvailable}
                              />
                            </td>
                            <td className="whitespace-nowrap px-5 py-3">
                              <ClinicianStatusBadge
                                status={participant.status}
                              />
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 p-5 md:hidden">
                  {filteredParticipants.map((participant) => {
                    const linkedCount =
                      runCountByParticipant.get(participant.id) ?? 0;
                    const activityAvailable =
                      participant.id === DEMO_PARTICIPANT_ID ||
                      linkedCount > 0;

                    return (
                      <article
                        key={participant.id}
                        className="rounded-xl border border-line p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            href={`/clinician/participants/${participant.id}`}
                            className="min-w-0 rounded-md"
                          >
                            <ParticipantIdentity
                              participant={participant}
                              asHeading
                            />
                          </Link>
                          <ClinicianStatusBadge
                            status={participant.status}
                          />
                        </div>

                        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line/70 pt-4">
                          <div>
                            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                              Last session
                            </dt>
                            <dd className="mt-1 text-xs text-ink-muted">
                              {formatDate(participant.lastSessionAt)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                              Sessions
                            </dt>
                            <dd className="mt-1 font-mono text-xs text-ink-muted">
                              {participant.sessionCount}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                              Signal quality
                            </dt>
                            <dd className="mt-1 font-mono text-xs text-ink-muted">
                              {participant.signalQuality}%
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                              CPT runs
                            </dt>
                            <dd className="mt-1">
                              <LinkedRunValue
                                count={linkedCount}
                                available={activityAvailable}
                              />
                            </dd>
                          </div>
                        </dl>

                        <ButtonLink
                          href={`/clinician/participants/${participant.id}`}
                          variant="outline"
                          size="sm"
                          className="mt-4 w-full"
                          aria-label={`Open overview for ${participant.displayName}`}
                        >
                          Open participant overview
                          <ArrowRight
                            aria-hidden="true"
                            className="size-3.5"
                          />
                        </ButtonLink>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        <CardFooter className="flex-wrap">
          <p aria-live="polite" className="text-xs text-ink-subtle">
            Showing {filteredParticipants.length} of {participants.length}{" "}
            synthetic participants
          </p>
          <span className="text-xs text-ink-subtle">Synthetic data</span>
        </CardFooter>
      </Card>
    </div>
  );
}
