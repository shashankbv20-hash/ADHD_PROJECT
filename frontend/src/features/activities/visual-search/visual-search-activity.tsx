"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  VISUAL_SEARCH_KEYS,
  VISUAL_SEARCH_PRACTICE_TRIALS,
  VISUAL_SEARCH_RESPONSE_WINDOW_MS,
  VISUAL_SEARCH_SCORED_TRIALS,
} from "@/features/activities/visual-search/visual-search-config";
import {
  summarizeVisualSearch,
  type VisualSearchSummary,
} from "@/features/activities/visual-search/visual-search-scoring";
import { recordRun } from "@/features/activities/run-log";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import type { VisualSearchRunView } from "@/lib/backend/summary-mapping";
import type { BackendVisualSearchEvent } from "@/lib/backend/types";
import { formatDateTime } from "@/lib/utils";

type Mode = "practice" | "scored";
type Phase = "intro" | "running" | "practice-done" | "scored-done";
type Answer = "present" | "absent";
type SaveState =
  | { status: "local" }
  | { status: "saving" }
  | { status: "saved"; message: string }
  | { status: "failed"; message: string };

const show = (value: number | null, suffix = "") => (value === null ? "—" : `${value}${suffix}`);

function newRunId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function Summary({ summary }: { summary: VisualSearchSummary }) {
  const rows: [string, string][] = [
    ["Accuracy", show(summary.accuracyPercent, "%")],
    ["Target present", show(summary.presentAccuracyPercent, "%")],
    ["Target absent", show(summary.absentAccuracyPercent, "%")],
    ["Mean time", show(summary.meanReactionTimeMs, " ms")],
    ...summary.bySetSize.map(
      (size): [string, string] => [`Mean time (${size.setSize} items)`, show(size.meanReactionTimeMs, " ms")],
    ),
    ["Search slope", show(summary.searchSlopeMsPerItem, " ms/item")],
    ["Wrong answer", String(summary.errorCount)],
    ["No answer", String(summary.omissionCount)],
  ];

  return (
    <div className="space-y-3">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">{label}</dt>
            <dd className="mt-1 font-mono text-lg font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-ink-subtle">
        The search slope is how much longer a correct answer takes for each extra item on the screen, using
        trials where the red T was present. It is only shown when at least two grid sizes have correct answers.
      </p>
    </div>
  );
}

export function VisualSearchActivity() {
  const sync = useOptionalBackendSync();
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("practice");
  const [trialIndex, setTrialIndex] = useState(0);
  const [summary, setSummary] = useState<VisualSearchSummary | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "local" });
  const [thisVisit, setThisVisit] = useState<{ id: string; at: string; summary: VisualSearchSummary }[]>([]);

  const trialStartedAt = useRef(0);
  const answer = useRef<{ response: Answer; reactionTimeMs: number } | null>(null);
  const events = useRef<BackendVisualSearchEvent[]>([]);
  const timer = useRef<number | null>(null);
  const runId = useRef(newRunId());

  const trials = mode === "practice" ? VISUAL_SEARCH_PRACTICE_TRIALS : VISUAL_SEARCH_SCORED_TRIALS;

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(
    (nextMode: Mode) => {
      clearTimer();
      events.current = [];
      answer.current = null;
      runId.current = newRunId();
      setSave({ status: "local" });
      setSummary(null);
      setMode(nextMode);
      setTrialIndex(0);
      setPhase("running");
    },
    [clearTimer],
  );

  const finishRun = useCallback(
    async (finishedMode: Mode) => {
      const result = summarizeVisualSearch(events.current);
      setSummary(result);

      if (finishedMode === "practice") {
        setPhase("practice-done");
        return;
      }

      setPhase("scored-done");
      recordRun("visual-search", runId.current, result);
      setThisVisit((previous) => [{ id: runId.current, at: new Date().toISOString(), summary: result }, ...previous]);

      // Saved only when the participant has already granted research consent; never otherwise.
      if (sync && sync.consent.status === "granted") {
        setSave({ status: "saving" });
        try {
          const outcome = await sync.persistVisualSearchRun(runId.current, events.current);
          setSave({ status: "saved", message: outcome.message });
        } catch (error) {
          setSave({
            status: "failed",
            message: error instanceof Error ? error.message : "The run could not be saved.",
          });
        }
      }
    },
    [sync],
  );

  const respond = useCallback(
    (response: Answer) => {
      if (phase !== "running" || answer.current !== null) return;
      answer.current = { response, reactionTimeMs: Math.round(performance.now() - trialStartedAt.current) };
    },
    [phase],
  );

  // One effect drives each trial: show the grid, wait for the window, record the outcome, move on.
  useEffect(() => {
    if (phase !== "running") return;
    const trial = trials[trialIndex];
    if (!trial) return;

    trialStartedAt.current = performance.now();
    answer.current = null;

    timer.current = window.setTimeout(() => {
      const given = answer.current;
      events.current.push({
        trialIndex,
        trialId: trial.id,
        setSize: trial.setSize,
        targetPresent: trial.targetPresent,
        responded: given !== null,
        response: given?.response ?? null,
        reactionTimeMs: given?.reactionTimeMs ?? null,
      });
      if (trialIndex + 1 < trials.length) {
        setTrialIndex(trialIndex + 1);
      } else {
        void finishRun(mode);
      }
    }, VISUAL_SEARCH_RESPONSE_WINDOW_MS);

    return clearTimer;
  }, [phase, mode, trialIndex, trials, clearTimer, finishRun]);

  useEffect(() => {
    if (phase !== "running") return;
    function onKey(event: KeyboardEvent) {
      const response = VISUAL_SEARCH_KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (response && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        respond(response);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, respond]);

  useEffect(() => clearTimer, [clearTimer]);

  const current = trials[trialIndex];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cognitive activity"
        title="Visual Search"
        description="Look for a red T hidden among blue Ts and red Ls, and say whether it is there. It measures how quickly a person can find a target as the screen gets busier. This is a demonstration task, not a clinical assessment, and it needs colour vision."
      />

      {phase === "intro" ? (
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              Each screen shows a few letters. Decide whether a <strong>red T</strong> is among them. Press
              &quot;Present&quot; (left arrow or F) if it is, or &quot;Absent&quot; (right arrow or J) if it
              is not. The other letters are blue Ts and red Ls. You have{" "}
              {(VISUAL_SEARCH_RESPONSE_WINDOW_MS / 1000).toFixed(1)} s for each screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-muted">
              A short practice of {VISUAL_SEARCH_PRACTICE_TRIALS.length} screens comes first, then{" "}
              {VISUAL_SEARCH_SCORED_TRIALS.length} scored screens. Practice is never saved.
            </p>
            <Button onClick={() => start("practice")}>Start practice</Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === "running" && current ? (
        <Card>
          <CardHeader>
            <CardTitle>{mode === "practice" ? "Practice" : "Scored run"}</CardTitle>
            <CardDescription>
              Screen {trialIndex + 1} of {trials.length}. Is a red T here?
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <div
              role="img"
              aria-label={`A grid of ${current.setSize} letters. Is there a red T?`}
              className="grid h-48 w-72 grid-cols-4 content-center justify-items-center gap-2"
            >
              {current.items.map((item, index) => (
                <span
                  key={index}
                  className={`text-3xl font-bold ${item.colour === "red" ? "text-red-600" : "text-blue-600"}`}
                >
                  {item.letter}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" variant="outline" onClick={() => respond("present")} className="min-w-32">
                ← Present (F)
              </Button>
              <Button size="lg" variant="outline" onClick={() => respond("absent")} className="min-w-32">
                Absent (J) →
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {phase === "practice-done" && summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Practice complete</CardTitle>
            <CardDescription>Practice results are not saved.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Summary summary={summary} />
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => start("scored")}>Start scored run</Button>
              <Button variant="outline" onClick={() => start("practice")}>
                Practice again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {phase === "scored-done" && summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Scored run complete</CardTitle>
            <CardDescription>
              {sync
                ? "With your research consent the run is sent to the research backend, which checks the trials and calculates the results."
                : "These results live in this browser tab only and are cleared when you reload."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Summary summary={summary} />
            {save.status === "saving" ? <p role="status" className="text-sm text-ink-muted">Saving…</p> : null}
            {save.status === "saved" ? (
              <Alert tone="success" title="Saved">
                {save.message}
              </Alert>
            ) : null}
            {save.status === "failed" ? (
              <Alert tone="danger" title="Not saved">
                {save.message}
              </Alert>
            ) : null}
            {sync && sync.consent.status !== "granted" ? (
              <Alert tone="info" title="Not saved">
                Research consent has not been granted, so this run was not saved. You can grant it on the
                Digital Twin page.
              </Alert>
            ) : null}
            <p className="text-xs text-ink-subtle">
              Visual Search results are kept separate from the CPT-based Digital Twin for now.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => start("scored")}>Run again</Button>
              <ButtonLink href="/participant/activities" variant="outline">
                Back to library
              </ButtonLink>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <HistoryCard serverRuns={sync?.visualSearchRuns ?? null} thisVisit={thisVisit} />
    </div>
  );
}

function HistoryCard({
  serverRuns,
  thisVisit,
}: {
  /** Null when the app is not connected to the research backend. */
  serverRuns: VisualSearchRunView[] | null;
  thisVisit: { id: string; at: string; summary: VisualSearchSummary }[];
}) {
  const rows =
    serverRuns !== null
      ? serverRuns.map((run) => ({
          id: run.id,
          at: run.completedAt,
          accuracy: run.accuracyPercent,
          meanRt: run.meanReactionTimeMs,
          slope: run.searchSlopeMsPerItem,
        }))
      : thisVisit.map((run) => ({
          id: run.id,
          at: run.at,
          accuracy: run.summary.accuracyPercent,
          meanRt: run.summary.meanReactionTimeMs,
          slope: run.summary.searchSlopeMsPerItem,
        }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previous Visual Search runs</CardTitle>
        <CardDescription>
          {serverRuns !== null
            ? "Scored runs saved to the research backend with your consent, newest first."
            : "Runs from this visit only. In demonstration mode nothing is stored, so this list is cleared when you reload."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted">No scored runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm text-ink-muted">
              <caption className="sr-only">Previous scored Visual Search runs</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-subtle">
                  <th scope="col" className="py-1.5 pr-3 font-medium">When</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Accuracy</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Mean time</th>
                  <th scope="col" className="py-1.5 font-medium">Search slope</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60">
                    <th scope="row" className="py-1.5 pr-3 font-normal text-ink">{formatDateTime(row.at)} UTC</th>
                    <td className="py-1.5 pr-3 font-mono">{show(row.accuracy, "%")}</td>
                    <td className="py-1.5 pr-3 font-mono">{show(row.meanRt, " ms")}</td>
                    <td className="py-1.5 font-mono">{show(row.slope, " ms/item")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
