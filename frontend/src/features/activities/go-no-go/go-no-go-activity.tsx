"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GO_NO_GO_PRACTICE_TRIALS,
  GO_NO_GO_RESPONSE_WINDOW_MS,
  GO_NO_GO_SCORED_TRIALS,
  GO_NO_GO_STIMULUS_DURATION_MS,
} from "@/features/activities/go-no-go/go-no-go-config";
import { calculateCptMetrics, createCptTrialEvent } from "@/features/activities/cpt/scoring";
import { recordRun } from "@/features/activities/run-log";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import type { GoNoGoRunView } from "@/lib/backend/summary-mapping";
import { formatDateTime } from "@/lib/utils";
import type { CptMetrics, CptTrialEvent } from "@/types";

type Mode = "practice" | "scored";
type Phase = "intro" | "running" | "practice-done" | "scored-done";
type SaveState =
  | { status: "local" }
  | { status: "saving" }
  | { status: "saved"; message: string }
  | { status: "failed"; message: string };

function newRunId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function Summary({ metrics }: { metrics: CptMetrics }) {
  const rows: [string, string][] = [
    ["Accuracy", metrics.accuracyPercent === null ? "—" : `${metrics.accuracyPercent}%`],
    ["Correct go responses", String(metrics.hitCount)],
    ["Missed go cues (omissions)", String(metrics.missCount)],
    ["Pressed on no-go (commissions)", String(metrics.falseAlarmCount)],
    ["Correctly held back", String(metrics.correctRejectionCount)],
    [
      "Mean go reaction time",
      metrics.meanHitReactionTimeMs === null ? "—" : `${metrics.meanHitReactionTimeMs} ms`,
    ],
  ];

  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">{label}</dt>
          <dd className="mt-1 font-mono text-lg font-semibold text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function GoNoGoActivity() {
  const sync = useOptionalBackendSync();
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("practice");
  const [trialIndex, setTrialIndex] = useState(0);
  const [showStimulus, setShowStimulus] = useState(false);
  const [metrics, setMetrics] = useState<CptMetrics | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "local" });
  const [thisVisit, setThisVisit] = useState<{ id: string; at: string; metrics: CptMetrics }[]>([]);

  const trialStartedAt = useRef(0);
  const reactionTime = useRef<number | null>(null);
  const events = useRef<CptTrialEvent[]>([]);
  const timers = useRef<number[]>([]);
  const runId = useRef(newRunId());

  const trials = mode === "practice" ? GO_NO_GO_PRACTICE_TRIALS : GO_NO_GO_SCORED_TRIALS;

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  const start = useCallback(
    (nextMode: Mode) => {
      clearTimers();
      events.current = [];
      reactionTime.current = null;
      runId.current = newRunId();
      setSave({ status: "local" });
      setMetrics(null);
      setMode(nextMode);
      setTrialIndex(0);
      setPhase("running");
    },
    [clearTimers],
  );

  const finishRun = useCallback(
    async (finishedMode: Mode) => {
      const result = calculateCptMetrics(events.current);
      setMetrics(result);

      if (finishedMode === "practice") {
        setPhase("practice-done");
        return;
      }

      setPhase("scored-done");
      recordRun("go-no-go", runId.current, result);
      setThisVisit((previous) => [
        { id: runId.current, at: new Date().toISOString(), metrics: result },
        ...previous,
      ]);
      // Saved only when the participant has already granted research consent; never otherwise.
      if (sync && sync.consent.status === "granted") {
        setSave({ status: "saving" });
        try {
          const outcome = await sync.persistGoNoGoRun(runId.current, events.current);
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

  const response = useCallback(() => {
    if (phase !== "running" || reactionTime.current !== null) return;
    reactionTime.current = performance.now() - trialStartedAt.current;
  }, [phase]);

  // One effect drives each trial: show the cue, hide it, then record the outcome and move on.
  useEffect(() => {
    if (phase !== "running") return;
    const trial = trials[trialIndex];
    if (!trial) return;

    trialStartedAt.current = performance.now();
    reactionTime.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowStimulus(true);

    const hide = window.setTimeout(() => setShowStimulus(false), GO_NO_GO_STIMULUS_DURATION_MS);
    const end = window.setTimeout(() => {
      const rt = reactionTime.current;
      events.current.push(
        createCptTrialEvent(trial, trialIndex, { responded: rt !== null, reactionTimeMs: rt }),
      );
      if (trialIndex + 1 < trials.length) {
        setTrialIndex(trialIndex + 1);
      } else {
        void finishRun(mode);
      }
    }, GO_NO_GO_RESPONSE_WINDOW_MS);
    timers.current = [hide, end];

    return clearTimers;
  }, [phase, mode, trialIndex, trials, clearTimers, finishRun]);

  useEffect(() => {
    if (phase !== "running") return;
    function onKey(event: KeyboardEvent) {
      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        response();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, response]);

  useEffect(() => clearTimers, [clearTimers]);

  const current = trials[trialIndex];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cognitive activity"
        title="Go / No-Go"
        description="Press for the green circle and hold back for the red one. It measures how well a person can respond quickly and still stop themselves. This is a demonstration task, not a clinical assessment."
      />

      {phase === "intro" ? (
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              A circle appears for about {GO_NO_GO_STIMULUS_DURATION_MS} ms. Green: press the button or
              the space bar as fast as you can. Red: do nothing. You have{" "}
              {(GO_NO_GO_RESPONSE_WINDOW_MS / 1000).toFixed(1)} s for each one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-muted">
              A short practice of {GO_NO_GO_PRACTICE_TRIALS.length} trials comes first, then{" "}
              {GO_NO_GO_SCORED_TRIALS.length} scored trials. Practice is never saved.
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
              Trial {trialIndex + 1} of {trials.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <div
              role="img"
              aria-label={showStimulus ? (current.isTarget ? "Go: green circle" : "No-go: red circle") : "Waiting"}
              className="flex size-40 items-center justify-center"
            >
              {showStimulus ? (
                <span
                  className={`size-28 rounded-full ${current.isTarget ? "bg-green-600" : "bg-red-600"}`}
                />
              ) : null}
            </div>
            <Button size="lg" onClick={response}>
              Press (or space bar)
            </Button>
            <p className="text-sm text-ink-muted">
              <span className="font-semibold text-green-700">Green: press.</span>{" "}
              <span className="font-semibold text-red-700">Red: do not press anything.</span>
            </p>
          </CardContent>
        </Card>
      ) : null}

      {phase === "practice-done" && metrics ? (
        <Card>
          <CardHeader>
            <CardTitle>Practice complete</CardTitle>
            <CardDescription>Practice results are not saved.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Summary metrics={metrics} />
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => start("scored")}>Start scored run</Button>
              <Button variant="outline" onClick={() => start("practice")}>
                Practice again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {phase === "scored-done" && metrics ? (
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
            <Summary metrics={metrics} />
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
              Go/No-Go results are kept separate from the CPT-based Digital Twin for now.
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

      <HistoryCard serverRuns={sync?.goNoGoRuns ?? null} thisVisit={thisVisit} />
    </div>
  );
}

function HistoryCard({
  serverRuns,
  thisVisit,
}: {
  /** Null when the app is not connected to the research backend. */
  serverRuns: GoNoGoRunView[] | null;
  thisVisit: { id: string; at: string; metrics: CptMetrics }[];
}) {
  const rows =
    serverRuns !== null
      ? serverRuns.map((run) => ({
          id: run.id,
          at: run.completedAt,
          accuracy: run.accuracyPercent,
          omissions: run.omissions,
          commissions: run.commissions,
          rt: run.meanGoReactionTimeMs,
        }))
      : thisVisit.map((run) => ({
          id: run.id,
          at: run.at,
          accuracy: run.metrics.accuracyPercent,
          omissions: run.metrics.missCount,
          commissions: run.metrics.falseAlarmCount,
          rt: run.metrics.meanHitReactionTimeMs,
        }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previous Go/No-Go runs</CardTitle>
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
              <caption className="sr-only">Previous scored Go/No-Go runs</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-subtle">
                  <th scope="col" className="py-1.5 pr-3 font-medium">When</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Accuracy</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Missed go</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Pressed on red</th>
                  <th scope="col" className="py-1.5 font-medium">Mean go time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60">
                    <th scope="row" className="py-1.5 pr-3 font-normal text-ink">{formatDateTime(row.at)} UTC</th>
                    <td className="py-1.5 pr-3 font-mono">{row.accuracy === null ? "—" : `${row.accuracy}%`}</td>
                    <td className="py-1.5 pr-3 font-mono">{row.omissions}</td>
                    <td className="py-1.5 pr-3 font-mono">{row.commissions}</td>
                    <td className="py-1.5 font-mono">{row.rt === null ? "—" : `${row.rt} ms`}</td>
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
