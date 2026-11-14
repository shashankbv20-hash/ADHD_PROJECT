"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateCptMetrics, createCptTrialEvent } from "@/features/activities/cpt/scoring";
import {
  N_BACK_LEVEL_LENGTH,
  N_BACK_LETTER_DURATION_MS,
  N_BACK_PRACTICE_TRIALS,
  N_BACK_RESPONSE_WINDOW_MS,
  N_BACK_SCORED_TRIALS,
  nBackLevel,
} from "@/features/activities/n-back/n-back-config";
import { recordRun } from "@/features/activities/run-log";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import type { NBackRunView } from "@/lib/backend/summary-mapping";
import { formatDateTime } from "@/lib/utils";
import type { CptMetrics, CptTrialEvent } from "@/types";

type Mode = "practice" | "scored";
type Phase = "intro" | "running" | "level-break" | "practice-done" | "scored-done";
type SaveState =
  | { status: "local" }
  | { status: "saving" }
  | { status: "saved"; message: string }
  | { status: "failed"; message: string };

interface Result {
  metrics: CptMetrics;
  oneBackAccuracy: number | null;
  twoBackAccuracy: number | null;
}

const show = (value: number | null, suffix = "") => (value === null ? "—" : `${value}${suffix}`);

function newRunId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function accuracyOf(events: readonly CptTrialEvent[]): number | null {
  if (events.length === 0) return null;
  const correct = events.filter((event) => event.outcome === "hit" || event.outcome === "correct-rejection");
  return Math.round((correct.length / events.length) * 100);
}

function summarize(events: readonly CptTrialEvent[], mode: Mode): Result {
  return {
    metrics: calculateCptMetrics(events),
    oneBackAccuracy: accuracyOf(mode === "scored" ? events.slice(0, N_BACK_LEVEL_LENGTH) : events),
    twoBackAccuracy: mode === "scored" ? accuracyOf(events.slice(N_BACK_LEVEL_LENGTH)) : null,
  };
}

function Summary({ result, mode }: { result: Result; mode: Mode }) {
  const { metrics } = result;
  const rows: [string, string][] = [
    ["Accuracy", show(metrics.accuracyPercent, "%")],
    ["1-back accuracy", show(result.oneBackAccuracy, "%")],
    ...(mode === "scored" ? ([["2-back accuracy", show(result.twoBackAccuracy, "%")]] as [string, string][]) : []),
    ["Matches found", `${metrics.hitCount} of ${metrics.targetCount}`],
    ["Matches missed", String(metrics.missCount)],
    ["Pressed on a non-match", String(metrics.falseAlarmCount)],
    ["Mean match reaction time", show(metrics.meanHitReactionTimeMs, " ms")],
  ];

  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">{label}</dt>
          <dd className="mt-1 font-mono text-lg font-semibold text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const RULE: Record<1 | 2, string> = {
  1: "Press when the letter is the same as the one just before it.",
  2: "Press when the letter is the same as the one two letters back.",
};

export function NBackActivity() {
  const sync = useOptionalBackendSync();
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("practice");
  const [trialIndex, setTrialIndex] = useState(0);
  const [showLetter, setShowLetter] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "local" });
  const [thisVisit, setThisVisit] = useState<{ id: string; at: string; result: Result }[]>([]);

  const trialStartedAt = useRef(0);
  const reactionTime = useRef<number | null>(null);
  const events = useRef<CptTrialEvent[]>([]);
  const timers = useRef<number[]>([]);
  const runId = useRef(newRunId());

  const trials = mode === "practice" ? N_BACK_PRACTICE_TRIALS : N_BACK_SCORED_TRIALS;
  const level = nBackLevel(mode, trialIndex);

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
      setResult(null);
      setMode(nextMode);
      setTrialIndex(0);
      setPhase("running");
    },
    [clearTimers],
  );

  const finishRun = useCallback(
    async (finishedMode: Mode) => {
      const summary = summarize(events.current, finishedMode);
      setResult(summary);

      if (finishedMode === "practice") {
        setPhase("practice-done");
        return;
      }

      setPhase("scored-done");
      recordRun("n-back", runId.current, summary);
      setThisVisit((previous) => [{ id: runId.current, at: new Date().toISOString(), result: summary }, ...previous]);

      // Saved only when the participant has already granted research consent; never otherwise.
      if (sync && sync.consent.status === "granted") {
        setSave({ status: "saving" });
        try {
          const outcome = await sync.persistNBackRun(runId.current, events.current);
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

  const respond = useCallback(() => {
    if (phase !== "running" || reactionTime.current !== null) return;
    reactionTime.current = performance.now() - trialStartedAt.current;
  }, [phase]);

  // One effect drives each trial: show the letter, hide it, then record the outcome and move on.
  useEffect(() => {
    if (phase !== "running") return;
    const trial = trials[trialIndex];
    if (!trial) return;

    trialStartedAt.current = performance.now();
    reactionTime.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowLetter(true);

    const hide = window.setTimeout(() => setShowLetter(false), N_BACK_LETTER_DURATION_MS);
    const end = window.setTimeout(() => {
      const rt = reactionTime.current;
      events.current.push(createCptTrialEvent(trial, trialIndex, { responded: rt !== null, reactionTimeMs: rt }));

      if (trialIndex + 1 >= trials.length) {
        void finishRun(mode);
        return;
      }
      setTrialIndex(trialIndex + 1);
      // Tell the person the rule is changing before the first 2-back trial.
      if (mode === "scored" && trialIndex + 1 === N_BACK_LEVEL_LENGTH) {
        setPhase("level-break");
      }
    }, N_BACK_RESPONSE_WINDOW_MS);
    timers.current = [hide, end];

    return clearTimers;
  }, [phase, mode, trialIndex, trials, clearTimers, finishRun]);

  useEffect(() => {
    if (phase !== "running") return;
    function onKey(event: KeyboardEvent) {
      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        respond();
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
        title="N-back"
        description="Letters appear one at a time. Press when a letter matches the one shown 1 step earlier, then 2 steps earlier. It measures working memory. This is a demonstration task, not a clinical assessment."
      />

      {phase === "intro" ? (
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              A letter shows for about {N_BACK_LETTER_DURATION_MS / 1000} s. In the 1-back level, press the
              button or the space bar when it is the same as the letter just before. In the 2-back level,
              press when it matches the letter two back. Otherwise do nothing. You have{" "}
              {(N_BACK_RESPONSE_WINDOW_MS / 1000).toFixed(1)} s for each letter.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-muted">
              A short 1-back practice of {N_BACK_PRACTICE_TRIALS.length} letters comes first. The scored run
              is {N_BACK_LEVEL_LENGTH} letters of 1-back, then {N_BACK_LEVEL_LENGTH} of 2-back. Practice is
              never saved.
            </p>
            <Button onClick={() => start("practice")}>Start practice</Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === "level-break" ? (
        <Card>
          <CardHeader>
            <CardTitle>Now 2-back</CardTitle>
            <CardDescription>{RULE[2]} The first two letters of this level cannot be matches.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setPhase("running")}>Continue</Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === "running" && current ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {mode === "practice" ? "Practice" : "Scored run"} · {level}-back
            </CardTitle>
            <CardDescription>
              Trial {trialIndex + 1} of {trials.length}. {RULE[level]}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <div
              role="img"
              aria-label={showLetter ? `Letter ${current.stimulus}` : "Waiting"}
              className="flex size-40 items-center justify-center text-7xl font-semibold text-ink"
            >
              {showLetter ? current.stimulus : null}
            </div>
            <Button size="lg" onClick={respond}>
              It matches (or space bar)
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === "practice-done" && result ? (
        <Card>
          <CardHeader>
            <CardTitle>Practice complete</CardTitle>
            <CardDescription>Practice results are not saved.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Summary result={result} mode="practice" />
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => start("scored")}>Start scored run</Button>
              <Button variant="outline" onClick={() => start("practice")}>
                Practice again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {phase === "scored-done" && result ? (
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
            <Summary result={result} mode="scored" />
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
              N-back results are kept separate from the CPT-based Digital Twin for now.
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

      <HistoryCard serverRuns={sync?.nBackRuns ?? null} thisVisit={thisVisit} />
    </div>
  );
}

function HistoryCard({
  serverRuns,
  thisVisit,
}: {
  /** Null when the app is not connected to the research backend. */
  serverRuns: NBackRunView[] | null;
  thisVisit: { id: string; at: string; result: Result }[];
}) {
  const rows =
    serverRuns !== null
      ? serverRuns.map((run) => ({
          id: run.id,
          at: run.completedAt,
          accuracy: run.accuracyPercent,
          one: run.oneBackAccuracyPercent,
          two: run.twoBackAccuracyPercent,
          hits: run.hits,
          falseAlarms: run.falseAlarms,
        }))
      : thisVisit.map((run) => ({
          id: run.id,
          at: run.at,
          accuracy: run.result.metrics.accuracyPercent,
          one: run.result.oneBackAccuracy,
          two: run.result.twoBackAccuracy,
          hits: run.result.metrics.hitCount,
          falseAlarms: run.result.metrics.falseAlarmCount,
        }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previous N-back runs</CardTitle>
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
            <table className="w-full min-w-[480px] text-left text-sm text-ink-muted">
              <caption className="sr-only">Previous scored N-back runs</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-subtle">
                  <th scope="col" className="py-1.5 pr-3 font-medium">When</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Accuracy</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">1-back</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">2-back</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Matches found</th>
                  <th scope="col" className="py-1.5 font-medium">False presses</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60">
                    <th scope="row" className="py-1.5 pr-3 font-normal text-ink">{formatDateTime(row.at)} UTC</th>
                    <td className="py-1.5 pr-3 font-mono">{show(row.accuracy, "%")}</td>
                    <td className="py-1.5 pr-3 font-mono">{show(row.one, "%")}</td>
                    <td className="py-1.5 pr-3 font-mono">{show(row.two, "%")}</td>
                    <td className="py-1.5 pr-3 font-mono">{row.hits}</td>
                    <td className="py-1.5 font-mono">{row.falseAlarms}</td>
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
