"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RULE_LABELS,
  TASK_SWITCHING_KEYS,
  TASK_SWITCHING_PRACTICE_TRIALS,
  TASK_SWITCHING_RESPONSE_WINDOW_MS,
  TASK_SWITCHING_SCORED_TRIALS,
} from "@/features/activities/task-switching/task-switching-config";
import {
  summarizeTaskSwitching,
  type TaskSwitchingSummary,
} from "@/features/activities/task-switching/task-switching-scoring";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import type { TaskSwitchingRunView } from "@/lib/backend/summary-mapping";
import type { BackendTaskSwitchingEvent } from "@/lib/backend/types";
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

function Summary({ summary }: { summary: TaskSwitchingSummary }) {
  const rows: [string, string][] = [
    ["Accuracy", show(summary.accuracyPercent, "%")],
    ["Repeat trials", show(summary.repeatAccuracyPercent, "%")],
    ["Switch trials", show(summary.switchAccuracyPercent, "%")],
    ["Mean time (repeat)", show(summary.meanRepeatReactionTimeMs, " ms")],
    ["Mean time (switch)", show(summary.meanSwitchReactionTimeMs, " ms")],
    ["Switch cost", show(summary.switchCostMs, " ms")],
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
        A switch trial uses a different rule from the trial before it; a repeat trial uses the same rule. Switch
        cost is how much slower correct answers are on switch trials. It is only shown when both have correct
        answers.
      </p>
    </div>
  );
}

export function TaskSwitchingActivity() {
  const sync = useOptionalBackendSync();
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("practice");
  const [trialIndex, setTrialIndex] = useState(0);
  const [summary, setSummary] = useState<TaskSwitchingSummary | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "local" });
  const [thisVisit, setThisVisit] = useState<{ id: string; at: string; summary: TaskSwitchingSummary }[]>([]);

  const trialStartedAt = useRef(0);
  const answer = useRef<{ side: "L" | "R"; reactionTimeMs: number } | null>(null);
  const events = useRef<BackendTaskSwitchingEvent[]>([]);
  const timer = useRef<number | null>(null);
  const runId = useRef(newRunId());

  const trials = mode === "practice" ? TASK_SWITCHING_PRACTICE_TRIALS : TASK_SWITCHING_SCORED_TRIALS;

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
      const result = summarizeTaskSwitching(events.current);
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
          const outcome = await sync.persistTaskSwitchingRun(runId.current, events.current);
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
    (side: "L" | "R") => {
      if (phase !== "running" || answer.current !== null) return;
      answer.current = { side, reactionTimeMs: Math.round(performance.now() - trialStartedAt.current) };
    },
    [phase],
  );

  // One effect drives each trial: show it, wait for the window, record the outcome, move on.
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
        rule: trial.rule,
        colour: trial.colour,
        shape: trial.shape,
        responded: given !== null,
        responseSide: given?.side ?? null,
        reactionTimeMs: given?.reactionTimeMs ?? null,
      });
      if (trialIndex + 1 < trials.length) {
        setTrialIndex(trialIndex + 1);
      } else {
        void finishRun(mode);
      }
    }, TASK_SWITCHING_RESPONSE_WINDOW_MS);

    return clearTimer;
  }, [phase, mode, trialIndex, trials, clearTimer, finishRun]);

  useEffect(() => {
    if (phase !== "running") return;
    function onKey(event: KeyboardEvent) {
      const side = TASK_SWITCHING_KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (side && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        respond(side);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, respond]);

  useEffect(() => clearTimer, [clearTimer]);

  const current = trials[trialIndex];
  const labels = current ? RULE_LABELS[current.rule] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cognitive activity"
        title="Task Switching"
        description="Each trial shows a coloured shape and a rule: sort it by COLOUR or by SHAPE. The rule changes now and then. It measures how well a person shifts between two rules. This is a demonstration task, not a clinical assessment, and it needs colour vision."
      />

      {phase === "intro" ? (
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              Read the rule above the shape. For COLOUR, press left for red or right for blue. For SHAPE, press
              left for circle or right for square. Use the buttons, the arrow keys, or F (left) and J (right).
              You have {(TASK_SWITCHING_RESPONSE_WINDOW_MS / 1000).toFixed(1)} s for each one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-muted">
              A short practice of {TASK_SWITCHING_PRACTICE_TRIALS.length} trials comes first, then{" "}
              {TASK_SWITCHING_SCORED_TRIALS.length} scored trials. Practice is never saved.
            </p>
            <Button onClick={() => start("practice")}>Start practice</Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === "running" && current && labels ? (
        <Card>
          <CardHeader>
            <CardTitle>{mode === "practice" ? "Practice" : "Scored run"}</CardTitle>
            <CardDescription>
              Trial {trialIndex + 1} of {trials.length}. Rule: sort by {labels.title.toLowerCase()}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <p className="text-2xl font-bold tracking-wide text-ink">{labels.title}</p>
            <div
              role="img"
              aria-label={`A ${current.colour === "R" ? "red" : "blue"} ${current.shape === "O" ? "circle" : "square"}. Sort by ${labels.title.toLowerCase()}.`}
              className="flex h-32 items-center justify-center"
            >
              <div
                className={`h-24 w-24 ${current.shape === "O" ? "rounded-full" : "rounded-md"} ${
                  current.colour === "R" ? "bg-red-600" : "bg-blue-600"
                }`}
              />
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" variant="outline" onClick={() => respond("L")} className="min-w-32">
                ← {labels.left} (F)
              </Button>
              <Button size="lg" variant="outline" onClick={() => respond("R")} className="min-w-32">
                {labels.right} (J) →
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
              Task Switching results are kept separate from the CPT-based Digital Twin for now.
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

      <HistoryCard serverRuns={sync?.taskSwitchingRuns ?? null} thisVisit={thisVisit} />
    </div>
  );
}

function HistoryCard({
  serverRuns,
  thisVisit,
}: {
  /** Null when the app is not connected to the research backend. */
  serverRuns: TaskSwitchingRunView[] | null;
  thisVisit: { id: string; at: string; summary: TaskSwitchingSummary }[];
}) {
  const rows =
    serverRuns !== null
      ? serverRuns.map((run) => ({
          id: run.id,
          at: run.completedAt,
          accuracy: run.accuracyPercent,
          repeat: run.repeatAccuracyPercent,
          switched: run.switchAccuracyPercent,
          cost: run.switchCostMs,
        }))
      : thisVisit.map((run) => ({
          id: run.id,
          at: run.at,
          accuracy: run.summary.accuracyPercent,
          repeat: run.summary.repeatAccuracyPercent,
          switched: run.summary.switchAccuracyPercent,
          cost: run.summary.switchCostMs,
        }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previous Task Switching runs</CardTitle>
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
              <caption className="sr-only">Previous scored Task Switching runs</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-subtle">
                  <th scope="col" className="py-1.5 pr-3 font-medium">When</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Accuracy</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Repeat</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Switch</th>
                  <th scope="col" className="py-1.5 font-medium">Switch cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60">
                    <th scope="row" className="py-1.5 pr-3 font-normal text-ink">{formatDateTime(row.at)} UTC</th>
                    <td className="py-1.5 pr-3 font-mono">{show(row.accuracy, "%")}</td>
                    <td className="py-1.5 pr-3 font-mono">{show(row.repeat, "%")}</td>
                    <td className="py-1.5 pr-3 font-mono">{show(row.switched, "%")}</td>
                    <td className="py-1.5 font-mono">{show(row.cost, " ms")}</td>
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
