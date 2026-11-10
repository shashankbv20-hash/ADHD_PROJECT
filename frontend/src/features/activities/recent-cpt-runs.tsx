"use client";

import { Activity, ArrowRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import { formatDateTime } from "@/lib/utils";

export function RecentCptRuns() {
  const {
    cptRuns,
    clearCptRuns,
    storageMode,
    cloudSyncEnabled,
    canClearCptRuns,
    persistenceTarget,
  } = useActivitySessions();
  const isFirebase = storageMode === "firebase";
  const toBackend = isFirebase && persistenceTarget === "backend";
  const recentRuns = cptRuns.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent CPT runs</CardTitle>
        <CardDescription>
          {toBackend
            ? "Recent scored run summaries saved to the research backend or held in this browser session. The backend keeps the trial events of saved runs."
            : isFirebase
            ? "Recent scored run summaries available to this account or browser session. Firebase stores summary metrics only, never raw trial events."
            : "Completed scored runs in this browser session. These records live in memory and reset when the page is reloaded."}
        </CardDescription>
      </CardHeader>

      {cptRuns.length === 0 ? (
        <CardContent>
          <EmptyState
            icon={Activity}
            title="No CPT runs yet"
            description="Complete the practice and scored task to see an in-memory summary of accuracy, target detection, and reaction time."
            action={
              <ButtonLink href="/participant/activities/cpt">
                Try the CPT
              </ButtonLink>
            }
          />
        </CardContent>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <caption className="sr-only">
              {toBackend
                ? "Research backend and browser CPT summaries with completion time, metrics, and review links."
                : isFirebase
                ? "Firebase account and browser CPT summaries with completion time, metrics, and review links. Raw trial events are not uploaded."
                : "In-memory Continuous Performance Task runs with mode, completion time, accuracy, reaction-time summaries, and review links."}
            </caption>
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-subtle">
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Run
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Mode
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Completed
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Accuracy
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Hits
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Mean hit RT
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Review
                </th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((run) => (
                <tr
                  key={run.id}
                  className="border-b border-line/70 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs font-medium text-ink">
                    {run.id}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <Badge
                      tone={run.mode === "scored" ? "brand" : "neutral"}
                    >
                      {run.mode === "scored" ? "Scored" : "Practice"}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-ink-muted">
                    {formatDateTime(run.completedAt)} UTC
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-muted">
                    {run.accuracyPercent !== null
                      ? `${run.accuracyPercent}%`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-muted">
                    {run.hitCount}/{run.targetCount}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-muted">
                    {run.meanHitReactionTimeMs !== null
                      ? `${run.meanHitReactionTimeMs} ms`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <Link
                      href={`/participant/activities/history/${run.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
                    >
                      View run
                      <ArrowRight aria-hidden="true" className="size-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CardFooter className="flex-wrap">
        <p className="text-xs text-ink-subtle">
          {cptRuns.length} {isFirebase ? "available" : "in-memory"} run
          {cptRuns.length === 1 ? "" : "s"}
          {cptRuns.length > recentRuns.length
            ? ` · showing latest ${recentRuns.length}`
            : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {cptRuns.length > 0 ? (
            <Link
              href="/participant/activities/history"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
            >
              View all history
              <ArrowRight aria-hidden="true" className="size-3" />
            </Link>
          ) : null}
          {cptRuns.length > 0 && canClearCptRuns ? (
            <Button variant="ghost" size="sm" onClick={clearCptRuns}>
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Clear runs
            </Button>
          ) : cptRuns.length === 0 ? (
            <span className="text-xs text-ink-subtle">
              {isFirebase && cloudSyncEnabled
                ? "Syncing summaries"
                : "Not persisted"}
            </span>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  );
}
