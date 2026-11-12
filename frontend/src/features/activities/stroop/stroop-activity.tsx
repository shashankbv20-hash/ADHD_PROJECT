"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  STROOP_COLORS,
  STROOP_KEYS,
  STROOP_PRACTICE_TRIALS,
  STROOP_RESPONSE_WINDOW_MS,
  STROOP_SCORED_TRIALS,
} from "@/features/activities/stroop/stroop-config";
import { summarizeStroop, type StroopSummary } from "@/features/activities/stroop/stroop-scoring";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import type { StroopRunView } from "@/lib/backend/summary-mapping";
import type { BackendStroopEvent, StroopColor } from "@/lib/backend/types";
import { formatDateTime } from "@/lib/utils";

type Mode = "practice" | "scored";
type Phase = "intro" | "running" | "practice-done" | "scored-done";
type SaveState =
  | { status: "local" }
  | { status: "saving" }
  | { status: "saved"; message: string }
  | { status: "failed"; message: string };

const show = (value: number | null, suffix = "") => (value === null ? "—" : `${value}${suffix}`);

function newRunId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function Summary({ summary }: { summary: StroopSummary }) {
  const rows: [string, string][] = [
    ["Accuracy", show(summary.accuracyPercent, "%")],
    ["Word and ink agree", show(summary.congruentAccuracyPercent, "%")],
    ["Word and ink conflict", show(summary.incongruentAccuracyPercent, "%")],
    ["Mean time (agree)", show(summary.meanCongruentReactionTimeMs, " ms")],
    ["Mean time (conflict)", show(summary.meanIncongruentReactionTimeMs, " ms")],
    ["Interference", show(summary.interferenceMs, " ms")],
    ["Wrong colour", String(summary.errorCount)],
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
        Interference is how much slower correct answers are when the word and the ink colour conflict. It is
        only shown when both conditions have correct answers.
      </p>
    </div>
  );
}

export function StroopActivity() {
  const sync = useOptionalBackendSync();
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("practice");
  const [trialIndex, setTrialIndex] = useState(0);
  const [summary, setSummary] = useState<StroopSummary | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "local" });
  const [thisVisit, setThisVisit] = useState<{ id: string; at: string; summary: StroopSummary }[]>([]);

  const trialStartedAt = useRef(0);
  const answer = useRef<{ color: StroopColor; reactionTimeMs: number } | null>(null);
  const events = useRef<BackendStroopEvent[]>([]);
  const timer = useRef<number | null>(null);
  const runId = useRef(newRunId());

  const trials = mode === "practice" ? STROOP_PRACTICE_TRIALS : STROOP_SCORED_TRIALS;

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
      const result = summarizeStroop(events.current);
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
          const outcome = await sync.persistStroopRun(runId.current, events.current);
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
    (color: StroopColor) => {
      if (phase !== "running" || answer.current !== null) return;
      answer.current = { color, reactionTimeMs: Math.round(performance.now() - trialStartedAt.current) };
    },
    [phase],
  );

  // One effect drives each trial: show the word, wait for the window, record the outcome, move on.
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
        word: trial.word,
        ink: trial.ink,
        responded: given !== null,
        responseColor: given?.color ?? null,
        reactionTimeMs: given?.reactionTimeMs ?? null,
      });
      if (trialIndex + 1 < trials.length) {
        setTrialIndex(trialIndex + 1);
      } else {
        void finishRun(mode);
      }
    }, STROOP_RESPONSE_WINDOW_MS);

    return clearTimer;
  }, [phase, mode, trialIndex, trials, clearTimer, finishRun]);

  useEffect(() => {
    if (phase !== "running") return;
    function onKey(event: KeyboardEvent) {
      const color = STROOP_KEYS[event.key.toLowerCase()];
      if (color && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
        respond(color);
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
        title="Stroop"
        description="A colour word appears in an ink colour. Choose the colour of the ink, not the word. It measures how well a person can ignore a conflicting cue. This is a demonstration task, not a clinical assessment, and it needs colour vision."
      />

      {phase === "intro" ? (
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              You will see a colour word such as BLUE written in red ink. Press the button for the ink colour
              (red), or the key R, G, B or Y. Sometimes the word and the ink agree, and sometimes they conflict.
              You have {(STROOP_RESPONSE_WINDOW_MS / 1000).toFixed(1)} s for each one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-muted">
              A short practice of {STROOP_PRACTICE_TRIALS.length} trials comes first, then{" "}
              {STROOP_SCORED_TRIALS.length} scored trials. Practice is never saved.
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
              Trial {trialIndex + 1} of {trials.length}. Choose the colour of the ink.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <div
              role="img"
              aria-label="A colour word. Choose the colour of the ink."
              className={`flex h-32 items-center justify-center text-6xl font-bold ${STROOP_COLORS[current.ink].css}`}
            >
              {STROOP_COLORS[current.word].name}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {(Object.keys(STROOP_COLORS) as StroopColor[]).map((color) => (
                <Button
                  key={color}
                  size="lg"
                  onClick={() => respond(color)}
                  className={`min-w-28 text-white ${STROOP_COLORS[color].button}`}
                >
                  {STROOP_COLORS[color].name[0] + STROOP_COLORS[color].name.slice(1).toLowerCase()} ({color})
                </Button>
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
              Stroop results are kept separate from the CPT-based Digital Twin for now.
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

      <HistoryCard serverRuns={sync?.stroopRuns ?? null} thisVisit={thisVisit} />
    </div>
  );
}

function HistoryCard({
  serverRuns,
  thisVisit,
}: {
  /** Null when the app is not connected to the research backend. */
  serverRuns: StroopRunView[] | null;
  thisVisit: { id: string; at: string; summary: StroopSummary }[];
}) {
  const rows =
    serverRuns !== null
      ? serverRuns.map((run) => ({
          id: run.id,
          at: run.completedAt,
          accuracy: run.accuracyPercent,
          agree: run.congruentAccuracyPercent,
          conflict: run.incongruentAccuracyPercent,
          interference: run.interferenceMs,
        }))
      : thisVisit.map((run) => ({
          id: run.id,
          at: run.at,
          accuracy: run.summary.accuracyPercent,
          agree: run.summary.congruentAccuracyPercent,
          conflict: run.summary.incongruentAccuracyPercent,
          interference: run.summary.interferenceMs,
        }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previous Stroop runs</CardTitle>
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
              <caption className="sr-only">Previous scored Stroop runs</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-subtle">
                  <th scope="col" className="py-1.5 pr-3 font-medium">When</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Accuracy</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Agree</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Conflict</th>
                  <th scope="col" className="py-1.5 font-medium">Interference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60">
                    <th scope="row" className="py-1.5 pr-3 font-normal text-ink">{formatDateTime(row.at)} UTC</th>
                    <td className="py-1.5 pr-3 font-mono">{show(row.accuracy, "%")}</td>
                    <td className="py-1.5 pr-3 font-mono">{show(row.agree, "%")}</td>
                    <td className="py-1.5 pr-3 font-mono">{show(row.conflict, "%")}</td>
                    <td className="py-1.5 font-mono">{show(row.interference, " ms")}</td>
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
