"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ARENA,
  CUE_MS,
  makeObjects,
  OBJECT_COUNT,
  RADIUS,
  SELECT_TIME_LIMIT_MS,
  stepObjects,
  TRACK_MS,
  TRACKING_PRACTICE_TRIALS,
  TRACKING_SCORED_TRIALS,
  type MovingObject,
} from "@/features/activities/object-tracking/object-tracking-config";
import {
  summarizeObjectTracking,
  type ObjectTrackingSummary,
} from "@/features/activities/object-tracking/object-tracking-scoring";
import { recordRun } from "@/features/activities/run-log";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import type { ObjectTrackingRunView } from "@/lib/backend/summary-mapping";
import type { BackendObjectTrackingEvent } from "@/lib/backend/types";
import { formatDateTime } from "@/lib/utils";

type Mode = "practice" | "scored";
type Phase = "intro" | "running" | "practice-done" | "scored-done";
/** cue: targets are marked. track: all circles look the same. select: circles stop and are picked. */
type Stage = "cue" | "track" | "select";
type SaveState =
  | { status: "local" }
  | { status: "saving" }
  | { status: "saved"; message: string }
  | { status: "failed"; message: string };

const COLOURS = { plain: "#2563eb", target: "#f59e0b", picked: "#16a34a" };

const show = (value: number | null, suffix = "") => (value === null ? "—" : `${value}${suffix}`);

function newRunId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function Summary({ summary }: { summary: ObjectTrackingSummary }) {
  const rows: [string, string][] = [
    ["Trials perfect", `${summary.perfectCount} of ${summary.trialCount}`],
    ["Circles found", show(summary.targetsFoundPercent, "%")],
    ["Most circles tracked perfectly", show(summary.highestPerfectLoad)],
    ["Wrong picks", String(summary.wrongPickCount)],
    ["Picking time", show(summary.meanResponseTimeMs, " ms")],
    ...summary.byLoad.map(
      (load): [string, string] => [`Found with ${load.targetCount} to track`, show(load.targetsFoundPercent, "%")],
    ),
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
        A trial is perfect when exactly the marked circles were picked. &quot;Circles found&quot; gives partial
        credit across all trials.
      </p>
    </div>
  );
}

function draw(
  canvas: HTMLCanvasElement | null,
  objects: readonly MovingObject[],
  marked: readonly number[],
  picked: readonly number[],
  numbered: boolean,
) {
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  objects.forEach((object, index) => {
    context.beginPath();
    context.arc(object.x, object.y, RADIUS, 0, Math.PI * 2);
    context.fillStyle = picked.includes(index)
      ? COLOURS.picked
      : marked.includes(index)
        ? COLOURS.target
        : COLOURS.plain;
    context.fill();
    if (numbered) {
      context.fillStyle = "#ffffff";
      context.font = "bold 14px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(index + 1), object.x, object.y + 1);
    }
  });
}

export function ObjectTrackingActivity() {
  const sync = useOptionalBackendSync();
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("practice");
  const [trialIndex, setTrialIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("cue");
  const [picked, setPicked] = useState<number[]>([]);
  const [summary, setSummary] = useState<ObjectTrackingSummary | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "local" });
  const [thisVisit, setThisVisit] = useState<{ id: string; at: string; summary: ObjectTrackingSummary }[]>([]);

  const canvas = useRef<HTMLCanvasElement | null>(null);
  const objects = useRef<MovingObject[]>([]);
  const selectStartedAt = useRef(0);
  const events = useRef<BackendObjectTrackingEvent[]>([]);
  const timers = useRef<number[]>([]);
  const runId = useRef(newRunId());

  const trials = mode === "practice" ? TRACKING_PRACTICE_TRIALS : TRACKING_SCORED_TRIALS;
  const trial = trials[trialIndex];

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const finishRun = useCallback(
    async (finishedMode: Mode) => {
      const result = summarizeObjectTracking(
        events.current,
        finishedMode === "practice" ? TRACKING_PRACTICE_TRIALS : TRACKING_SCORED_TRIALS,
      );
      setSummary(result);

      if (finishedMode === "practice") {
        setPhase("practice-done");
        return;
      }

      setPhase("scored-done");
      recordRun("multiple-object-tracking", runId.current, result);
      setThisVisit((previous) => [{ id: runId.current, at: new Date().toISOString(), summary: result }, ...previous]);

      // Saved only when the participant has already granted research consent; never otherwise.
      if (sync && sync.consent.status === "granted") {
        setSave({ status: "saving" });
        try {
          const outcome = await sync.persistObjectTrackingRun(runId.current, events.current);
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

  /** Records the current trial with the circles picked so far and moves on. */
  const endTrial = useCallback(
    (selected: number[]) => {
      clearTimers();
      const current = trials[trialIndex];
      if (!current) return;
      events.current.push({
        trialIndex,
        trialId: current.id,
        objectCount: 8,
        targetCount: current.targets.length as 2 | 3 | 4,
        selected,
        responseTimeMs: selected.length ? Math.min(Math.round(performance.now() - selectStartedAt.current), 60_000) : null,
      });
      setPicked([]);
      if (trialIndex + 1 < trials.length) {
        setStage("cue");
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
      setPicked([]);
      setStage("cue");
      setTrialIndex(0);
      setPhase("running");
    },
    [clearTimers],
  );

  // Cue stage: place the circles, mark the targets, then start the tracking stage.
  useEffect(() => {
    if (phase !== "running" || stage !== "cue" || !trial) return;
    objects.current = makeObjects(trialIndex + (mode === "scored" ? 50 : 0));
    timers.current.push(window.setTimeout(() => setStage("track"), CUE_MS));
    return clearTimers;
  }, [phase, stage, trial, trialIndex, mode, clearTimers]);

  // Track stage: all circles look the same, then they stop and the child picks.
  useEffect(() => {
    if (phase !== "running" || stage !== "track") return;
    timers.current.push(
      window.setTimeout(() => {
        selectStartedAt.current = performance.now();
        setStage("select");
      }, TRACK_MS),
    );
    return clearTimers;
  }, [phase, stage, clearTimers]);

  // Select stage: a time limit so a stalled child does not hold up the run.
  useEffect(() => {
    if (phase !== "running" || stage !== "select") return;
    timers.current.push(window.setTimeout(() => endTrial(picked), SELECT_TIME_LIMIT_MS));
    return clearTimers;
    // The limit starts when the stage starts; later picks must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stage, trialIndex]);

  // Animation: move and draw while the circles are moving.
  useEffect(() => {
    if (phase !== "running" || !trial || (stage !== "cue" && stage !== "track")) return;
    let frame = 0;
    let last: number | null = null;
    const loop = (now: number) => {
      stepObjects(objects.current, last === null ? 0 : Math.min((now - last) / 1000, 0.05));
      last = now;
      draw(canvas.current, objects.current, stage === "cue" ? trial.targets : [], [], false);
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, stage, trial]);

  // Select stage: circles stay still and show their numbers and picks.
  useEffect(() => {
    if (phase !== "running" || stage !== "select") return;
    draw(canvas.current, objects.current, [], picked, true);
  }, [phase, stage, picked]);

  useEffect(() => clearTimers, [clearTimers]);

  const toggle = useCallback(
    (index: number) => {
      if (stage !== "select" || !trial) return;
      const next = picked.includes(index) ? picked.filter((i) => i !== index) : [...picked, index];
      if (next.length > trial.targets.length) return;
      setPicked(next);
      if (next.length === trial.targets.length) endTrial(next);
    },
    [stage, trial, picked, endTrial],
  );

  function onCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * ARENA.width;
    const y = ((event.clientY - box.top) / box.height) * ARENA.height;
    let best = -1;
    let bestDistance = RADIUS + 10;
    objects.current.forEach((object, index) => {
      const distance = Math.hypot(object.x - x, object.y - y);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    if (best >= 0) toggle(best);
  }

  const instruction =
    stage === "cue"
      ? "Watch the orange circles. Remember them."
      : stage === "track"
        ? "Keep following them. All circles look the same now."
        : `Pick the circles you followed (${picked.length} of ${trial?.targets.length ?? 0}).`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cognitive activity"
        title="Multiple Object Tracking"
        description="A few circles are marked, then all the circles move around looking the same. Keep following the marked ones, then pick them when the circles stop. It measures how many things a person can keep track of at once. This is a demonstration task, not a clinical assessment, and it needs you to see the screen."
      />

      {phase === "intro" ? (
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              Eight circles appear and some turn orange. After a moment the orange ones turn blue like the
              rest, and all the circles keep moving. Follow the ones that were orange. When they stop, each
              circle shows a number: tap the circles you followed, or use the number buttons. You have{" "}
              {SELECT_TIME_LIMIT_MS / 1000} s to pick.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-muted">
              A short practice of {TRACKING_PRACTICE_TRIALS.length} trial comes first, then{" "}
              {TRACKING_SCORED_TRIALS.length} scored trials following 2, 3 and 4 circles. Practice is never saved.
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
              Trial {trialIndex + 1} of {trials.length}: follow {trial.targets.length} circles. {instruction}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <canvas
              ref={canvas}
              width={ARENA.width}
              height={ARENA.height}
              onClick={onCanvasClick}
              role="img"
              aria-label={`${OBJECT_COUNT} moving circles. ${instruction}`}
              className="w-full max-w-[480px] rounded-lg border-2 border-line"
            />
            {stage === "select" ? (
              <>
                <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Pick circles by number">
                  {Array.from({ length: OBJECT_COUNT }, (_, index) => (
                    <Button
                      key={index}
                      variant={picked.includes(index) ? "primary" : "outline"}
                      aria-pressed={picked.includes(index)}
                      onClick={() => toggle(index)}
                      className="min-w-12"
                    >
                      {index + 1}
                    </Button>
                  ))}
                </div>
                <Button variant="outline" onClick={() => endTrial(picked)}>
                  Done
                </Button>
              </>
            ) : null}
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
                ? "With your research consent the run is sent to the research backend, which checks the picks and calculates the results."
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
              Object Tracking results are kept separate from the CPT-based Digital Twin for now.
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

      <HistoryCard serverRuns={sync?.objectTrackingRuns ?? null} thisVisit={thisVisit} />
    </div>
  );
}

function HistoryCard({
  serverRuns,
  thisVisit,
}: {
  /** Null when the app is not connected to the research backend. */
  serverRuns: ObjectTrackingRunView[] | null;
  thisVisit: { id: string; at: string; summary: ObjectTrackingSummary }[];
}) {
  const rows =
    serverRuns !== null
      ? serverRuns.map((run) => ({
          id: run.id,
          at: run.completedAt,
          perfect: `${run.perfectCount} of ${run.trialCount}`,
          found: run.targetsFoundPercent,
          load: run.highestPerfectLoad,
        }))
      : thisVisit.map((run) => ({
          id: run.id,
          at: run.at,
          perfect: `${run.summary.perfectCount} of ${run.summary.trialCount}`,
          found: run.summary.targetsFoundPercent,
          load: run.summary.highestPerfectLoad,
        }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previous Object Tracking runs</CardTitle>
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
              <caption className="sr-only">Previous scored Object Tracking runs</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-subtle">
                  <th scope="col" className="py-1.5 pr-3 font-medium">When</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Perfect</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Circles found</th>
                  <th scope="col" className="py-1.5 font-medium">Most tracked</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60">
                    <th scope="row" className="py-1.5 pr-3 font-normal text-ink">{formatDateTime(row.at)} UTC</th>
                    <td className="py-1.5 pr-3 font-mono">{row.perfect}</td>
                    <td className="py-1.5 pr-3 font-mono">{show(row.found, "%")}</td>
                    <td className="py-1.5 font-mono">{show(row.load)}</td>
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
