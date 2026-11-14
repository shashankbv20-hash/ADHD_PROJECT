"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  nextStopSignalDelay,
  SSD_START_MS,
  STOP_SIGNAL_ARROW_DURATION_MS,
  STOP_SIGNAL_PRACTICE_TRIALS,
  STOP_SIGNAL_RESPONSE_WINDOW_MS,
  STOP_SIGNAL_SCORED_TRIALS,
} from "@/features/activities/stop-signal/stop-signal-config";
import {
  summarizeStopSignal,
  type StopSignalSummary,
} from "@/features/activities/stop-signal/stop-signal-scoring";
import { recordRun } from "@/features/activities/run-log";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import type { StopSignalRunView } from "@/lib/backend/summary-mapping";
import type { BackendStopSignalEvent } from "@/lib/backend/types";
import { formatDateTime } from "@/lib/utils";

type Mode = "practice" | "scored";
type Phase = "intro" | "running" | "practice-done" | "scored-done";
type SaveState =
  | { status: "local" }
  | { status: "saving" }
  | { status: "saved"; message: string }
  | { status: "failed"; message: string };
type Direction = "L" | "R";

function newRunId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const show = (value: number | null, suffix = "") => (value === null ? "—" : `${value}${suffix}`);

function Summary({ summary }: { summary: StopSignalSummary }) {
  const rows: [string, string][] = [
    ["Arrow accuracy (go trials)", show(summary.goAccuracyPercent, "%")],
    ["Mean go reaction time", show(summary.meanGoReactionTimeMs, " ms")],
    ["Missed arrows", String(summary.goOmissionCount)],
    ["Wrong direction", String(summary.goWrongDirectionCount)],
    ["Stopped when told", `${summary.successfulStopCount} of ${summary.stopTrialCount}`],
    ["Stop success rate", show(summary.stopSuccessRatePercent, "%")],
    ["Mean stop-signal delay", show(summary.meanStopSignalDelayMs, " ms")],
    ["Stop-signal reaction time (SSRT)", show(summary.ssrtEstimateMs, " ms")],
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
      {summary.ssrtEstimateMs === null ? (
        <p className="text-xs text-ink-subtle">
          SSRT is only shown when between a quarter and three quarters of the stops failed; otherwise the
          estimate is not reliable.
        </p>
      ) : null}
    </div>
  );
}

export function StopSignalActivity() {
  const sync = useOptionalBackendSync();
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("practice");
  const [trialIndex, setTrialIndex] = useState(0);
  const [showArrow, setShowArrow] = useState(false);
  const [showStop, setShowStop] = useState(false);
  const [summary, setSummary] = useState<StopSignalSummary | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "local" });
  const [thisVisit, setThisVisit] = useState<{ id: string; at: string; summary: StopSignalSummary }[]>([]);

  const trialStartedAt = useRef(0);
  const answer = useRef<{ direction: Direction; reactionTimeMs: number } | null>(null);
  const events = useRef<BackendStopSignalEvent[]>([]);
  const timers = useRef<number[]>([]);
  const ssd = useRef(SSD_START_MS);
  const runId = useRef(newRunId());

  const trials = mode === "practice" ? STOP_SIGNAL_PRACTICE_TRIALS : STOP_SIGNAL_SCORED_TRIALS;

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  const start = useCallback(
    (nextMode: Mode) => {
      clearTimers();
      events.current = [];
      answer.current = null;
      ssd.current = SSD_START_MS;
      runId.current = newRunId();
      setSave({ status: "local" });
      setSummary(null);
      setMode(nextMode);
      setTrialIndex(0);
      setPhase("running");
    },
    [clearTimers],
  );

  const finishRun = useCallback(
    async (finishedMode: Mode) => {
      const result = summarizeStopSignal(events.current);
      setSummary(result);

      if (finishedMode === "practice") {
        setPhase("practice-done");
        return;
      }

      setPhase("scored-done");
      recordRun("stop-signal", runId.current, result);
      setThisVisit((previous) => [{ id: runId.current, at: new Date().toISOString(), summary: result }, ...previous]);

      // Saved only when the participant has already granted research consent; never otherwise.
      if (sync && sync.consent.status === "granted") {
        setSave({ status: "saving" });
        try {
          const outcome = await sync.persistStopSignalRun(runId.current, events.current);
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
    (direction: Direction) => {
      if (phase !== "running" || answer.current !== null) return;
      answer.current = { direction, reactionTimeMs: Math.round(performance.now() - trialStartedAt.current) };
    },
    [phase],
  );

  // One effect drives each trial: arrow, optional stop signal after the delay, then record and move on.
  useEffect(() => {
    if (phase !== "running") return;
    const trial = trials[trialIndex];
    if (!trial) return;

    trialStartedAt.current = performance.now();
    answer.current = null;
    const delay = ssd.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowArrow(true);
    setShowStop(false);

    const handles = [window.setTimeout(() => setShowArrow(false), STOP_SIGNAL_ARROW_DURATION_MS)];
    if (trial.isStop) {
      handles.push(window.setTimeout(() => setShowStop(true), delay));
    }
    handles.push(
      window.setTimeout(() => {
        const given = answer.current;
        events.current.push({
          trialIndex,
          trialId: trial.id,
          stimulus: trial.direction,
          isStop: trial.isStop,
          stopSignalDelayMs: trial.isStop ? delay : null,
          responded: given !== null,
          responseDirection: given?.direction ?? null,
          reactionTimeMs: given?.reactionTimeMs ?? null,
        });
        if (trial.isStop) {
          ssd.current = nextStopSignalDelay(delay, given === null);
        }
        if (trialIndex + 1 < trials.length) {
          setTrialIndex(trialIndex + 1);
        } else {
          setShowStop(false);
          void finishRun(mode);
        }
      }, STOP_SIGNAL_RESPONSE_WINDOW_MS),
    );
    timers.current = handles;

    return clearTimers;
  }, [phase, mode, trialIndex, trials, clearTimers, finishRun]);

  useEffect(() => {
    if (phase !== "running") return;
    function onKey(event: KeyboardEvent) {
      if (event.repeat) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        respond("L");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        respond("R");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, respond]);

  useEffect(() => clearTimers, [clearTimers]);

  const current = trials[trialIndex];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cognitive activity"
        title="Stop-Signal"
        description="Press the arrow key that matches the arrow. On some trials a red STOP border appears: then try not to press anything. This measures how quickly a person can cancel a response they have started. It is a demonstration task, not a clinical assessment."
      />

      {phase === "intro" ? (
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              An arrow points left or right. Press the matching arrow key (or the on-screen Left or Right
              button) as fast as you can. If a red STOP border appears, do not press anything. The stop
              signal comes sooner or later depending on how you are doing, so it stays hard but fair. You
              have {(STOP_SIGNAL_RESPONSE_WINDOW_MS / 1000).toFixed(1)} s for each trial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-muted">
              A short practice of {STOP_SIGNAL_PRACTICE_TRIALS.length} trials comes first, then{" "}
              {STOP_SIGNAL_SCORED_TRIALS.length} scored trials. Practice is never saved.
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
              aria-label={
                showStop
                  ? "Stop signal: do not press"
                  : showArrow
                    ? current.direction === "L"
                      ? "Arrow pointing left"
                      : "Arrow pointing right"
                    : "Waiting"
              }
              className={`flex size-44 items-center justify-center rounded-2xl border-4 ${
                showStop ? "border-red-600" : "border-transparent"
              }`}
            >
              {showArrow ? (
                current.direction === "L" ? (
                  <ArrowLeft aria-hidden="true" className="size-24 text-ink" />
                ) : (
                  <ArrowRight aria-hidden="true" className="size-24 text-ink" />
                )
              ) : null}
            </div>
            <div className="flex gap-4">
              <Button size="lg" onClick={() => respond("L")}>
                <ArrowLeft aria-hidden="true" className="size-4" />
                Left
              </Button>
              <Button size="lg" onClick={() => respond("R")}>
                Right
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <p className="text-sm text-ink-muted">
              Press the matching arrow. <span className="font-semibold text-red-700">Red border: do not press.</span>
            </p>
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
              Stop-Signal results are kept separate from the CPT-based Digital Twin for now.
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

      <HistoryCard serverRuns={sync?.stopSignalRuns ?? null} thisVisit={thisVisit} />
    </div>
  );
}

function HistoryCard({
  serverRuns,
  thisVisit,
}: {
  /** Null when the app is not connected to the research backend. */
  serverRuns: StopSignalRunView[] | null;
  thisVisit: { id: string; at: string; summary: StopSignalSummary }[];
}) {
  const rows =
    serverRuns !== null
      ? serverRuns.map((run) => ({
          id: run.id,
          at: run.completedAt,
          accuracy: run.goAccuracyPercent,
          stopRate: run.stopSuccessRatePercent,
          ssd: run.meanStopSignalDelayMs,
          ssrt: run.ssrtEstimateMs,
        }))
      : thisVisit.map((run) => ({
          id: run.id,
          at: run.at,
          accuracy: run.summary.goAccuracyPercent,
          stopRate: run.summary.stopSuccessRatePercent,
          ssd: run.summary.meanStopSignalDelayMs,
          ssrt: run.summary.ssrtEstimateMs,
        }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previous Stop-Signal runs</CardTitle>
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
            <table className="w-full min-w-[460px] text-left text-sm text-ink-muted">
              <caption className="sr-only">Previous scored Stop-Signal runs</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-subtle">
                  <th scope="col" className="py-1.5 pr-3 font-medium">When</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Arrow accuracy</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Stop success</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Mean delay</th>
                  <th scope="col" className="py-1.5 font-medium">SSRT</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60">
                    <th scope="row" className="py-1.5 pr-3 font-normal text-ink">{formatDateTime(row.at)} UTC</th>
                    <td className="py-1.5 pr-3 font-mono">{show(row.accuracy, "%")}</td>
                    <td className="py-1.5 pr-3 font-mono">{show(row.stopRate, "%")}</td>
                    <td className="py-1.5 pr-3 font-mono">{show(row.ssd, " ms")}</td>
                    <td className="py-1.5 font-mono">{show(row.ssrt, " ms")}</td>
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
