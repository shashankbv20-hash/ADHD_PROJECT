"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CELL_GAP_MS,
  CELL_LIGHT_MS,
  RECALL_TIME_LIMIT_MS,
  START_PAUSE_MS,
  VISUAL_SEQUENCE_PRACTICE_TRIALS,
  VISUAL_SEQUENCE_SCORED_TRIALS,
} from "@/features/activities/visual-sequence/visual-sequence-config";
import {
  summarizeVisualSequence,
  type VisualSequenceSummary,
} from "@/features/activities/visual-sequence/visual-sequence-scoring";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import type { VisualSequenceRunView } from "@/lib/backend/summary-mapping";
import type { BackendVisualSequenceEvent } from "@/lib/backend/types";
import { formatDateTime } from "@/lib/utils";

type Mode = "practice" | "scored";
type Phase = "intro" | "running" | "practice-done" | "scored-done";
type Stage = "show" | "recall";
type SaveState =
  | { status: "local" }
  | { status: "saving" }
  | { status: "saved"; message: string }
  | { status: "failed"; message: string };

const show = (value: number | null, suffix = "") => (value === null ? "—" : `${value}${suffix}`);

function newRunId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function Summary({ summary }: { summary: VisualSequenceSummary }) {
  const rows: [string, string][] = [
    ["Sequences correct", `${summary.correctCount} of ${summary.trialCount}`],
    ["Accuracy", show(summary.accuracyPercent, "%")],
    ["Longest span", show(summary.longestCorrectSpan, " squares")],
    ["Squares in right place", show(summary.correctPositionPercent, "%")],
    ["First tap", show(summary.meanFirstResponseMs, " ms")],
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
        Longest span is the longest sequence repeated exactly right. &quot;Squares in right place&quot; gives
        partial credit for taps that matched the sequence at the same position.
      </p>
    </div>
  );
}

export function VisualSequenceActivity() {
  const sync = useOptionalBackendSync();
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("practice");
  const [trialIndex, setTrialIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("show");
  const [lit, setLit] = useState<number | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [summary, setSummary] = useState<VisualSequenceSummary | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "local" });
  const [thisVisit, setThisVisit] = useState<{ id: string; at: string; summary: VisualSequenceSummary }[]>([]);

  const response = useRef<number[]>([]);
  const recallStartedAt = useRef(0);
  const firstTapAt = useRef<number | null>(null);
  const events = useRef<BackendVisualSequenceEvent[]>([]);
  const timers = useRef<number[]>([]);
  const runId = useRef(newRunId());

  const trials = mode === "practice" ? VISUAL_SEQUENCE_PRACTICE_TRIALS : VISUAL_SEQUENCE_SCORED_TRIALS;
  const trial = trials[trialIndex];

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const finishRun = useCallback(
    async (finishedMode: Mode) => {
      const result = summarizeVisualSequence(
        events.current,
        finishedMode === "practice" ? VISUAL_SEQUENCE_PRACTICE_TRIALS : VISUAL_SEQUENCE_SCORED_TRIALS,
      );
      setSummary(result);

      if (finishedMode === "practice") {
        setPhase("practice-done");
        return;
      }

      setPhase("scored-done");
      setThisVisit((previous) => [{ id: runId.current, at: new Date().toISOString(), summary: result }, ...previous]);

      // Saved only when the participant has already granted research consent; never otherwise.
      if (sync && sync.consent.status === "granted") {
        setSave({ status: "saving" });
        try {
          const outcome = await sync.persistVisualSequenceRun(runId.current, events.current);
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

  /** Records the current trial (complete or timed out) and moves on. */
  const endTrial = useCallback(() => {
    clearTimers();
    const current = trials[trialIndex];
    if (!current) return;
    const now = performance.now();
    events.current.push({
      trialIndex,
      trialId: current.id,
      sequenceLength: current.sequence.length,
      response: [...response.current],
      firstResponseLatencyMs:
        firstTapAt.current === null ? null : Math.round(firstTapAt.current - recallStartedAt.current),
      totalResponseTimeMs: Math.min(Math.round(now - recallStartedAt.current), 120_000),
    });
    response.current = [];
    firstTapAt.current = null;
    setTapCount(0);
    if (trialIndex + 1 < trials.length) {
      setStage("show");
      setTrialIndex(trialIndex + 1);
    } else {
      void finishRun(mode);
    }
  }, [clearTimers, trials, trialIndex, finishRun, mode]);

  const start = useCallback(
    (nextMode: Mode) => {
      clearTimers();
      events.current = [];
      response.current = [];
      firstTapAt.current = null;
      runId.current = newRunId();
      setSave({ status: "local" });
      setSummary(null);
      setMode(nextMode);
      setTapCount(0);
      setStage("show");
      setTrialIndex(0);
      setPhase("running");
    },
    [clearTimers],
  );

  // Show stage: light each square in turn, then hand over to the recall stage.
  useEffect(() => {
    if (phase !== "running" || stage !== "show" || !trial) return;
    let at = START_PAUSE_MS;
    for (const cell of trial.sequence) {
      timers.current.push(window.setTimeout(() => setLit(cell), at));
      timers.current.push(window.setTimeout(() => setLit(null), at + CELL_LIGHT_MS));
      at += CELL_LIGHT_MS + CELL_GAP_MS;
    }
    timers.current.push(
      window.setTimeout(() => {
        recallStartedAt.current = performance.now();
        setStage("recall");
      }, at),
    );
    return clearTimers;
  }, [phase, stage, trial, clearTimers]);

  // Recall stage: a time limit so a stalled child does not hold up the run.
  useEffect(() => {
    if (phase !== "running" || stage !== "recall") return;
    timers.current.push(window.setTimeout(endTrial, RECALL_TIME_LIMIT_MS));
    return clearTimers;
  }, [phase, stage, endTrial, clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  const tap = useCallback(
    (cell: number) => {
      if (phase !== "running" || stage !== "recall" || !trial) return;
      if (firstTapAt.current === null) firstTapAt.current = performance.now();
      response.current.push(cell);
      setTapCount(response.current.length);
      if (response.current.length >= trial.sequence.length) endTrial();
    },
    [phase, stage, trial, endTrial],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cognitive activity"
        title="Visual Sequence Memory"
        description="Watch squares light up one at a time, then tap them back in the same order. The sequences get longer. It measures short-term visual memory. This is a demonstration task, not a clinical assessment, and it needs you to see the screen."
      />

      {phase === "intro" ? (
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              A grid of nine squares appears. Some of them light up, one after another. Wait until the squares
              stop, then tap the same squares in the same order. You have {RECALL_TIME_LIMIT_MS / 1000} s to
              answer each one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-muted">
              A short practice of {VISUAL_SEQUENCE_PRACTICE_TRIALS.length} sequence comes first, then{" "}
              {VISUAL_SEQUENCE_SCORED_TRIALS.length} scored sequences of 3 to 6 squares. Practice is never saved.
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
              Sequence {trialIndex + 1} of {trials.length} ({trial.sequence.length} squares).{" "}
              {stage === "show"
                ? "Watch the squares."
                : `Your turn: tap them in order (${tapCount} of ${trial.sequence.length}).`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="grid grid-cols-3 gap-3" role="group" aria-label="Grid of nine squares">
              {Array.from({ length: 9 }, (_, cell) => (
                <button
                  key={cell}
                  type="button"
                  disabled={stage === "show"}
                  onClick={() => tap(cell)}
                  aria-label={`Square ${cell + 1}`}
                  className={`h-20 w-20 rounded-lg border-2 transition-colors ${
                    lit === cell ? "border-accent bg-accent" : "border-line bg-surface hover:bg-accent/10"
                  }`}
                />
              ))}
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
                ? "With your research consent the run is sent to the research backend, which checks the answers and calculates the results."
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
              Visual Sequence results are kept separate from the CPT-based Digital Twin for now.
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

      <HistoryCard serverRuns={sync?.visualSequenceRuns ?? null} thisVisit={thisVisit} />
    </div>
  );
}

function HistoryCard({
  serverRuns,
  thisVisit,
}: {
  /** Null when the app is not connected to the research backend. */
  serverRuns: VisualSequenceRunView[] | null;
  thisVisit: { id: string; at: string; summary: VisualSequenceSummary }[];
}) {
  const rows =
    serverRuns !== null
      ? serverRuns.map((run) => ({
          id: run.id,
          at: run.completedAt,
          correct: `${run.correctCount} of ${run.trialCount}`,
          span: run.longestCorrectSpan,
          positions: run.correctPositionPercent,
        }))
      : thisVisit.map((run) => ({
          id: run.id,
          at: run.at,
          correct: `${run.summary.correctCount} of ${run.summary.trialCount}`,
          span: run.summary.longestCorrectSpan,
          positions: run.summary.correctPositionPercent,
        }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previous Visual Sequence runs</CardTitle>
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
              <caption className="sr-only">Previous scored Visual Sequence runs</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-subtle">
                  <th scope="col" className="py-1.5 pr-3 font-medium">When</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Correct</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Longest span</th>
                  <th scope="col" className="py-1.5 font-medium">Right place</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60">
                    <th scope="row" className="py-1.5 pr-3 font-normal text-ink">{formatDateTime(row.at)} UTC</th>
                    <td className="py-1.5 pr-3 font-mono">{row.correct}</td>
                    <td className="py-1.5 pr-3 font-mono">{show(row.span)}</td>
                    <td className="py-1.5 font-mono">{show(row.positions, "%")}</td>
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
