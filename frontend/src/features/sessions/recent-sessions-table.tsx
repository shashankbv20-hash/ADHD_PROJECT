import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { SessionStatusBadge } from "@/features/sessions/session-status-badge";
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
import type { EegSession } from "@/types";

export function RecentSessionsTable({
  sessions,
}: {
  sessions: EegSession[];
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>Recent sessions</CardTitle>
          <CardDescription>
            Latest synthetic recordings from the demo participant.
          </CardDescription>
        </div>
        <Link
          href="/participant/sessions"
          className="inline-flex shrink-0 items-center gap-1 rounded text-sm font-medium text-brand-800 transition-colors hover:text-brand-600"
        >
          View all
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </CardHeader>

      {sessions.length === 0 ? (
        <CardContent>
          <EmptyState
            title="No sessions recorded"
            description="When a recording is added, it will appear here with its quality checks and analysis status."
          />
        </CardContent>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <caption className="sr-only">
              Recent demonstration EEG sessions
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
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
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
                    <SessionStatusBadge status={session.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CardFooter>
        <p className="text-xs text-ink-subtle">
          Upload a synthetic file to preview the processing and session record
          flow.
        </p>
        <span className="text-xs text-ink-subtle">Synthetic data</span>
      </CardFooter>
    </Card>
  );
}
