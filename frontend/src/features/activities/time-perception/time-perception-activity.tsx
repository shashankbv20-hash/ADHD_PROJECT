"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  REPRODUCE_TIME_LIMIT_MS,
  START_PAUSE_MS,
  TIME_PRACTICE_TRIALS,
  TIME_SCORED_TRIALS,
} from "@/features/activities/time-perception/time-perception-config";
import {
  summarizeTimePerception,
  type TimePerceptionSummary,
} from "@/features/activities/time-perception/time-perception-scoring";
import { recordRun } from "@/features/activities/run-log";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import type { TimePerceptionRunView } from "@/lib/backend/summary-mapping";
import type { BackendTimePerceptionEvent } from "@/lib/backend/types";
import { formatDateTime } from "@/lib/utils";

type Mode = "practice" | "scored";
type Phase = "intro" | "running" | "practice-done" | "scored-done";
/** show: the circle is displayed. reproduce: waiting for Start. timing: the child is timing it. */
type Stage = "show" | "reproduce" | "timing";
type SaveState =
  | { status: "local" }
  | { status: "saving" }
  | { status: "saved"; message: string }
  | { status: "failed"; message: string };

const show = (value: number | null, suffix = "") => (value === null ? "—" : `${value}${suffix}`);
const signed = (value: number | null, suffix = "") =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value}${suffix}`;

function newRunId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function Summary({ summary }: { summary: TimePerceptionSummary }) {
  const rows: [string, string][] = [
    ["Close to the target (within 20%)", `${summary.withinToleranceCount} of ${summary.trialCount}`],
    ["Average error", show(summary.meanAbsoluteErrorMs, " ms")],
    ["Tendency (+ too long, − too short)", signed(summary.meanSignedErrorMs, " ms")],
    ["Average ratio (1.00 is exact)", show(summary.meanRatio)],
    ["Consistency (lower is steadier)", show(summary.ratioVariability)],
    ["No answer", String(summary.noResponseCount)],
  ];

  return (
    <div className="space-y-3">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">{label}</dt>
            <dd className="mt-1 font-mono text-lg font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-ink-subtle">
        Error is how far each reproduced time was from the real one. The ratio is your time divided by the real
        time, so 1.20 means 20% too long. Please do not count out loud or tap along; just judge the time.
      </p>
    </div>
  );
}

export function TimePerceptionActivity() {
  const sync = useOptionalBackendSync();
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("practice");
  const [trialIndex, setTrialIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("show");
  const [circleVisible, setCircleVisible] = useState(false);
  const [summary, setSummary] = useState<TimePerceptionSummary | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "local" });
  const [thisVisit, setThisVisit] = useState<{ id: string; at: string; summary: TimePerceptionSummary }[]>([]);

  const timingStartedAt = useRef(0);
  const events = useRef<BackendTimePerceptionEvent[]>([]);
  const timers = useRef<number[]>([]);
  const runId = useRef(newRunId());

  const trials = mode === "practice" ? TIME_PRACTICE_TRIALS : TIME_SCORED_TRIALS;
  const trial = trials[trialIndex];

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const finishRun = useCallback(
    async (finishedMode: Mode) => {
      const result = summarizeTimePerception(events.current);
      setSummary(result);

      if (finishedMode === "practice") {
        setPhase("practice-done");
        return;
      }

      setPhase("scored-done");
      recordRun("time-perception", runId.current, result);
      setThisVisit((previous) => [{ id: runId.current, at: new Date().toISOString(), summary: result }, ...previous]);

      // Saved only when the participant has already granted research consent; never otherwise.
      if (sync && sync.consent.status === "granted") {
        setSave({ status: "saving" });
        try {
          const outcome = await sync.persistTimePerceptionRun(runId.current, events.current);
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

  /** Records the current trial (reproduced time, or null for no answer) and moves on. */
  const endTrial = useCallback(
    (reproducedMs: number | null) => {
      clearTimers();
      const current = trials[trialIndex];
      if (!current) return;
      events.current.push({
        trialIndex,
        trialId: current.id,
        targetMs: current.targetMs,
        reproducedMs: reproducedMs === null ? null : Math.min(Math.round(reproducedMs), 30_000),
      });
      if (trialIndex + 1 < trials.length) {
        setStage("show");
        setTrialIndex(trialIndex + 1);
      } else {
        void finishRun(mode);
      }
    },
    [clearTimers, trials, trialIndex, finishRun, mode],
  );

  const start = useCallback(
    (nextMode: Mode) => {
      clearTimers();
      events.current = [];
      runId.current = newRunId();
      setSave({ status: "local" });
      setSummary(null);
      setMode(nextMode);
      setStage("show");
      setCircleVisible(false);
      setTrialIndex(0);
      setPhase("running");
    },
    [clearTimers],
  );

  // Show stage: a short pause, the circle for the target duration, then hand over to the child.
  useEffect(() => {
    if (phase !== "running" || stage !== "show" || !trial) return;
    timers.current.push(window.setTimeout(() => setCircleVisible(true), START_PAUSE_MS));
    timers.current.push(
      window.setTimeout(() => {
        setCircleVisible(false);
        setStage("reproduce");
      }, START_PAUSE_MS + trial.targetMs),
    );
    return clearTimers;
  }, [phase, stage, trial, clearTimers]);

  // Reproduce and timing stages share one time limit, so a stalled child does not hold up the run.
  useEffect(() => {
    if (phase !== "running" || (stage !== "reproduce" && stage !== "timing")) return;
    timers.current.push(window.setTimeout(() => endTrial(null), REPRODUCE_TIME_LIMIT_MS));
    return clearTimers;
  }, [phase, stage, endTrial, clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  const press = useCallback(() => {
    if (stage === "reproduce") {
      timingStartedAt.current = performance.now();
      setStage("timing");
    } else if (stage === "timing") {
      endTrial(performance.now() - timingStartedAt.current);
    }
  }, [stage, endTrial]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cognitive activity"
        title="Time Perception"
        description="A circle appears for a few seconds. Then you press Start and Stop to show how long it was on the screen. It measures how well a person judges the passing of time. This is a demonstration task, not a clinical assessment, and it needs you to see the screen."
      />

      {phase === "intro" ? (
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              Watch the circle and notice how long it stays. When it disappears, press Start, wait for the same
              amount of time, and press Stop. Please do not count out loud or tap along.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-muted">
              A short practice of {TIME_PRACTICE_TRIALS.length} trial comes first, then {TIME_SCORED_TRIALS.length}{" "}
              scored trials with different durations. Practice is never saved.
            </p>
            <Button onClick={() => start("practice")}>Start practice</Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === "running" && trial ? (
        <Card>
          <CardHeader>
            <CardTitle>{mode === "practice" ? "Practice" : "Scored run"}</CardTitle>
            <CardDescription>
              Trial {trialIndex + 1} of {trials.length}.{" "}
              {stage === "show" ? "Watch the circle." : "Show how long the circle was on the screen."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <div className="flex h-40 items-center justify-center" role="img" aria-label={circleVisible ? "A circle" : "Nothing on screen"}>
              {circleVisible ? <div className="h-28 w-28 rounded-full bg-accent" /> : null}
            </div>
            {stage === "show" ? (
              <p role="status" className="text-sm text-ink-muted">Watch…</p>
            ) : (
              <Button size="lg" onClick={press} className="min-w-40">
                {stage === "reproduce" ? "Start" : "Stop"}
              </Button>
            )}
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
              Time Perception results are kept separate from the CPT-based Digital Twin for now.
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

      <HistoryCard serverRuns={sync?.timePerceptionRuns ?? null} thisVisit={thisVisit} />
    </div>
  );
}

function HistoryCard({
  serverRuns,
  thisVisit,
}: {
  /** Null when the app is not connected to the research backend. */
  serverRuns: TimePerceptionRunView[] | null;
  thisVisit: { id: string; at: string; summary: TimePerceptionSummary }[];
}) {
  const rows =
    serverRuns !== null
      ? serverRuns.map((run) => ({
          id: run.id,
          at: run.completedAt,
          close: `${run.withinToleranceCount} of ${run.trialCount}`,
          error: run.meanAbsoluteErrorMs,
          bias: run.meanSignedErrorMs,
        }))
      : thisVisit.map((run) => ({
          id: run.id,
          at: run.at,
          close: `${run.summary.withinToleranceCount} of ${run.summary.trialCount}`,
          error: run.summary.meanAbsoluteErrorMs,
          bias: run.summary.meanSignedErrorMs,
        }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previous Time Perception runs</CardTitle>
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
              <caption className="sr-only">Previous scored Time Perception runs</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-subtle">
                  <th scope="col" className="py-1.5 pr-3 font-medium">When</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Close</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Average error</th>
                  <th scope="col" className="py-1.5 font-medium">Tendency</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60">
                    <th scope="row" className="py-1.5 pr-3 font-normal text-ink">{formatDateTime(row.at)} UTC</th>
                    <td className="py-1.5 pr-3 font-mono">{row.close}</td>
                    <td className="py-1.5 pr-3 font-mono">{show(row.error, " ms")}</td>
                    <td className="py-1.5 font-mono">{signed(row.bias, " ms")}</td>
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
