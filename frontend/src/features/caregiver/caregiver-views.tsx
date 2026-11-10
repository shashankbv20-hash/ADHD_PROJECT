"use client";

import { ArrowLeft, ArrowRight, Check, Copy } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReportList, TwinSummary, display } from "@/features/backend/twin-summary";
import { useCaregiver } from "@/features/caregiver/caregiver-provider";
import type { CaregiverSubjectData } from "@/lib/backend/caregiver";
import { formatDateTime } from "@/lib/utils";

const WHAT_YOU_CAN_SEE = [
  "Progress and the Digital Twin summary calculated from the runs they chose to save.",
  "Reports created from those runs, and how many sessions were saved.",
];

const WHAT_YOU_CANNOT_SEE = [
  "Trial-by-trial responses, their data export, or their access log.",
  "Any control to change, add or delete their data or consent. Access is read-only, and they can stop sharing at any time.",
];

function CaregiverIdCard() {
  const { caregiverId } = useCaregiver();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(caregiverId);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your caregiver ID</CardTitle>
        <CardDescription>
          To see a participant&apos;s progress, give them this ID. They enter it on their Data &amp;
          privacy page. Nothing is shared until they do, and they can stop at any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <code className="break-all rounded-lg border border-line bg-slate-50 px-3 py-2 font-mono text-xs text-ink">
            {caregiverId}
          </code>
          <Button variant="outline" size="sm" onClick={() => void copy()}>
            {copied ? (
              <Check aria-hidden="true" className="size-3.5" />
            ) : (
              <Copy aria-hidden="true" className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy ID"}
          </Button>
        </div>
        {copyError ? (
          <p role="status" className="text-xs text-ink-subtle">
            Copying was blocked by the browser. Select the ID above and copy it manually.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReadOnlyNotice() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What caregiver access includes</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm leading-6 text-ink-muted md:grid-cols-2">
        <div>
          <p className="font-medium text-ink">You can see</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {WHAT_YOU_CAN_SEE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-medium text-ink">You cannot see or do</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {WHAT_YOU_CANNOT_SEE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs leading-5 text-ink-subtle md:col-span-2">
          Each time you view a participant, it is recorded in their access log as &ldquo;another
          account&rdquo;. Values are descriptive research measurements, not a diagnosis.
        </p>
      </CardContent>
    </Card>
  );
}

export function CaregiverOverview() {
  const { status, error, shared, refresh, stopViewing } = useCaregiver();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleStop(subjectId: string, relationshipId: string) {
    setBusy(true);
    setActionError(null);

    try {
      await stopViewing(subjectId, relationshipId);
      setConfirming(null);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Access could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Caregiver workspace"
        title="Shared with me"
        description="Read-only progress for participants who have chosen to share it with you."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" dot>
              Caregiver
            </Badge>
            <span className="text-xs text-ink-subtle">
              {shared.length} participant{shared.length === 1 ? "" : "s"}
            </span>
          </div>
        }
      />

      <CaregiverIdCard />
      <ReadOnlyNotice />

      {status === "error" ? (
        <Alert tone="danger" title="Shared participants could not be loaded">
          {error}{" "}
          <button
            type="button"
            onClick={() => void refresh()}
            className="font-medium underline underline-offset-2"
          >
            Try again
          </button>
        </Alert>
      ) : null}

      {actionError ? (
        <Alert tone="danger" title="Access was not removed">
          {actionError}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Participants sharing with you</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {status === "loading" ? (
            <p role="status" className="text-xs text-ink-subtle">
              Loading…
            </p>
          ) : null}

          {status === "ready" && shared.length === 0 ? (
            <p className="text-sm leading-6 text-ink-muted">
              No one is sharing with you yet. Give your caregiver ID above to a participant; once
              they add it, they appear here.
            </p>
          ) : null}

          {shared.map((subject) => (
            <article
              key={subject.relationshipId}
              className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-ink">{subject.label}</h3>
                <p className="text-xs text-ink-subtle">
                  {subject.sharedSince ? `Shared since ${formatDateTime(subject.sharedSince)} UTC` : "Shared"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ButtonLink href={`/caregiver/subjects/${subject.subjectId}`} variant="outline" size="sm">
                  View progress
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </ButtonLink>
                {confirming === subject.relationshipId ? (
                  <>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleStop(subject.subjectId, subject.relationshipId)}
                    >
                      {busy ? "Removing…" : "Yes, stop viewing"}
                    </Button>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(subject.relationshipId)}>
                    Stop viewing
                  </Button>
                )}
              </div>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function CaregiverSubjectView({ subjectId }: { subjectId: string }) {
  const { loadSubject, shared, status } = useCaregiver();
  const [data, setData] = useState<CaregiverSubjectData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const label = shared.find((subject) => subject.subjectId === subjectId)?.label ?? "Shared participant";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setData(await loadSubject(subjectId));
    } catch (caught) {
      setData(null);
      setError(caught instanceof Error ? caught.message : "This participant's progress could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [loadSubject, subjectId]);

  useEffect(() => {
    // Fetching remote data when the page opens is the purpose of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const notShared = status === "ready" && !shared.some((subject) => subject.subjectId === subjectId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Caregiver workspace"
        title={label}
        description="Read-only progress shared with you. Descriptive research measurements, not a diagnosis."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" dot>
              Read-only
            </Badge>
          </div>
        }
        actions={
          <ButtonLink href="/caregiver" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Shared with me
          </ButtonLink>
        }
      />

      {notShared || error ? (
        <Alert tone="warning" title="This participant is not available to you">
          {error ?? "They may have stopped sharing, or you may have followed an old link."}{" "}
          <Link href="/caregiver" className="font-medium underline underline-offset-2">
            Back to the list
          </Link>
        </Alert>
      ) : null}

      {data ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Digital Twin summary</CardTitle>
                <Badge tone="brand">Version {data.twin.version}</Badge>
              </div>
              <CardDescription>
                Calculated from the runs this participant saved after giving research consent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TwinSummary
                loading={false}
                twin={data.twin}
                twinHistory={data.twinHistory}
                emptyMessage="No runs have been saved yet, so there is nothing to show."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saved runs</CardTitle>
              <CardDescription>
                {data.runs.length} scored run{data.runs.length === 1 ? "" : "s"} · {data.sessionCount} saved
                session{data.sessionCount === 1 ? "" : "s"}. Only the summary of each run is shown.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.runs.length === 0 ? (
                <p className="text-sm text-ink-muted">No saved runs yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <caption className="sr-only">Saved scored CPT runs with accuracy and reaction time</caption>
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-subtle">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Completed (UTC)
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Accuracy
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Hits / misses
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          False alarms
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          Mean hit reaction time
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.runs.map((run) => (
                        <tr key={run.id} className="border-b border-line/60 text-ink-muted">
                          <td className="py-2 pr-3 font-mono text-xs">{formatDateTime(run.completedAt)}</td>
                          <td className="py-2 pr-3 font-mono">{display(run.accuracyPercent, "%")}</td>
                          <td className="py-2 pr-3 font-mono">
                            {run.hitCount} / {run.missCount}
                          </td>
                          <td className="py-2 pr-3 font-mono">{run.falseAlarmCount}</td>
                          <td className="py-2 font-mono">{display(run.meanHitReactionTimeMs, " ms")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
              <CardDescription>Created by the participant from their saved runs.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.reports.length === 0 ? (
                <p className="text-sm text-ink-muted">No reports have been created.</p>
              ) : (
                <ReportList reports={data.reports} />
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {loading && !data ? (
        <p role="status" className="text-xs text-ink-subtle">
          Loading progress…
        </p>
      ) : null}
    </div>
  );
}
