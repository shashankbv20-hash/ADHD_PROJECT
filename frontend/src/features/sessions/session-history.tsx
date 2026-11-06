"use client";

import { SearchX } from "lucide-react";
import { useState } from "react";
import { SessionStatusBadge } from "@/features/sessions/session-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { cn, formatDate, formatDuration } from "@/lib/utils";
import type { EegSession, SessionStatus } from "@/types";

type Filter = "all" | SessionStatus;

const filterOptions: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "analyzed", label: "Analyzed" },
  { value: "processing", label: "Processing" },
  { value: "needs-review", label: "Needs review" },
  { value: "failed", label: "Failed" },
];

function qualityTone(quality: number): string {
  if (quality >= 90) {
    return "bg-success";
  }

  if (quality >= 80) {
    return "bg-brand-500";
  }

  return "bg-demo";
}

export function SessionHistory({ sessions }: { sessions: EegSession[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSessions = sessions.filter((session) => {
    const matchesFilter = filter === "all" || session.status === filter;
    const matchesQuery =
      !normalizedQuery ||
      session.id.toLowerCase().includes(normalizedQuery) ||
      session.protocol.toLowerCase().includes(normalizedQuery);

    return matchesFilter && matchesQuery;
  });

  const countFor = (value: Filter) =>
    value === "all"
      ? sessions.length
      : sessions.filter((session) => session.status === value).length;

  function resetFilters() {
    setFilter("all");
    setQuery("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preloaded sessions</CardTitle>
        <CardDescription>
          Filter or search preloaded synthetic sessions. Session detail is
          available for files added through the demo upload flow.
        </CardDescription>
      </CardHeader>

      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="group"
          aria-label="Filter sessions by status"
          className="flex flex-wrap gap-1.5"
        >
          {filterOptions.map((option) => {
            const active = filter === option.value;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(option.value)}
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

        <div className="w-full lg:w-64">
          <label htmlFor="session-search" className="sr-only">
            Search sessions by ID or protocol
          </label>
          <Input
            id="session-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ID or protocol"
          />
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={SearchX}
            title="No matching sessions"
            description="No demonstration sessions match the current filter and search. Adjust the query or show all sessions."
            action={
              <Button variant="outline" onClick={resetFilters}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <caption className="sr-only">
              Demonstration EEG session history with status, signal quality, and
              illustrative focus index.
            </caption>
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-subtle">
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Session
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Protocol
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Recorded
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Duration
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Signal quality
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Focus index
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session) => (
                <tr
                  key={session.id}
                  className="border-b border-line/70 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs font-medium text-ink">
                    {session.id}
                  </td>
                  <td className="px-5 py-3 text-ink-muted">
                    {session.protocol}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-ink-muted">
                    {formatDate(session.recordedAt)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-ink-muted">
                    {formatDuration(session.durationMinutes)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-ink">
                        {session.signalQuality}%
                      </span>
                      <span
                        aria-hidden="true"
                        className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"
                      >
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            qualityTone(session.signalQuality),
                          )}
                          style={{ width: `${session.signalQuality}%` }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-muted">
                    {session.focusIndex !== null
                      ? `${session.focusIndex}/100`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <SessionStatusBadge status={session.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CardFooter>
        <p aria-live="polite" className="text-xs text-ink-subtle">
          Showing {filteredSessions.length} of {sessions.length} demo sessions
        </p>
        <span className="text-xs text-ink-subtle">Synthetic data</span>
      </CardFooter>
    </Card>
  );
}
