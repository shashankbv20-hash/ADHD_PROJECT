"use client";

import {
  ArrowLeft,
  ArrowRight,
  Keyboard,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
  Target,
  Timer,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  participantDemoMeta,
} from "@/data/demo/participant";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import {
  CPT_PRACTICE_TRIALS,
  CPT_RESPONSE_WINDOW_MS,
  CPT_SCORED_TRIALS,
  CPT_STIMULUS_DURATION_MS,
  CPT_TARGET_STIMULUS,
} from "@/features/activities/cpt/cpt-config";
import { cptOutcomeConfig } from "@/features/activities/cpt/cpt-outcome";
import { CptSummary } from "@/features/activities/cpt/cpt-summary";
import {
  calculateCptMetrics,
  createCptTrialEvent,
} from "@/features/activities/cpt/scoring";
import { cn } from "@/lib/utils";
import type {
  CptMetrics,
  CptRunSummary,
  CptTrialEvent,
} from "@/types";

type CptPhase =
  | "intro"
  | "active"
  | "practice-feedback"
  | "practice-summary"
  | "summary";

type TrialMode = "practice" | "scored";

function CptRunDetails() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Run details</CardTitle>
        <CardDescription>
          A fixed, reproducible sequence keeps every demo run comparable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">Target</dt>
            <dd className="font-mono text-base font-semibold text-ink">
              {CPT_TARGET_STIMULUS}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">Practice</dt>
            <dd className="font-mono text-xs text-ink">
              {CPT_PRACTICE_TRIALS.length} trials
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">Scored</dt>
            <dd className="font-mono text-xs text-ink">
              {CPT_SCORED_TRIALS.length} trials
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">Stimulus</dt>
            <dd className="font-mono text-xs text-ink">
              {CPT_STIMULUS_DURATION_MS} ms
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">Response window</dt>
            <dd className="font-mono text-xs text-ink">
              {(CPT_RESPONSE_WINDOW_MS / 1000).toFixed(1)} s
            </dd>
          </div>
        </dl>

        <div className="space-y-3 rounded-lg border border-line bg-slate-50/60 p-3 text-xs leading-5 text-ink-muted">
          <div>
            <p className="flex items-center gap-2 font-medium text-ink">
              <Keyboard aria-hidden="true" className="size-4" />
              Keyboard
            </p>
            <p className="mt-1">
              Press Space to respond. Escape pauses; resuming restarts the
              current trial.
            </p>
          </div>
          <div>
            <p className="flex items-center gap-2 font-medium text-ink">
              <MousePointerClick aria-hidden="true" className="size-4" />
              Pointer
            </p>
            <p className="mt-1">
              Use the Respond button. It records at most one response per trial.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CptActivity() {
  const {
    saveCptRun,
    participantId,
    storageMode,
    cloudSyncEnabled,
    persistenceStatus,
    persistenceMessage,
  } = useActivitySessions();
  const firebaseAuth = useFirebaseAuth();

  const [phase, setPhase] = useState<CptPhase>("intro");
  const [mode, setMode] = useState<TrialMode>("practice");
  const [trialIndex, setTrialIndex] = useState(0);
  const [showStimulus, setShowStimulus] = useState(false);
  const [responded, setResponded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [practiceEvents, setPracticeEvents] = useState<CptTrialEvent[]>([]);
  const [lastPracticeEvent, setLastPracticeEvent] =
    useState<CptTrialEvent | null>(null);
  const [practiceMetrics, setPracticeMetrics] = useState<CptMetrics | null>(
    null,
  );
  const [runSummary, setRunSummary] = useState<CptRunSummary | null>(null);

  const trialStartedAtRef = useRef(0);
  const respondedRef = useRef(false);
  const reactionTimeRef = useRef<number | null>(null);
  const finishedRef = useRef(true);
  const practiceEventsRef = useRef<CptTrialEvent[]>([]);
  const scoredEventsRef = useRef<CptTrialEvent[]>([]);
  const stimulusTimerRef = useRef<number | null>(null);
  const trialTimerRef = useRef<number | null>(null);
  const respondButtonRef = useRef<HTMLButtonElement>(null);
  const resumeButtonRef = useRef<HTMLButtonElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const focusRespondRef = useRef(false);

  const trials = mode === "practice" ? CPT_PRACTICE_TRIALS : CPT_SCORED_TRIALS;
  const totalTrials = trials.length;
  const currentTrial = trials[trialIndex];
  const isPractice = mode === "practice";
  const practiceFeedback = lastPracticeEvent
    ? cptOutcomeConfig[lastPracticeEvent.outcome]
    : null;

  const clearTrialTimers = useCallback(() => {
    if (stimulusTimerRef.current !== null) {
      window.clearTimeout(stimulusTimerRef.current);
      stimulusTimerRef.current = null;
    }

    if (trialTimerRef.current !== null) {
      window.clearTimeout(trialTimerRef.current);
      trialTimerRef.current = null;
    }
  }, []);

  const resetRunState = useCallback(() => {
    clearTrialTimers();
    respondedRef.current = false;
    reactionTimeRef.current = null;
    finishedRef.current = true;
    practiceEventsRef.current = [];
    scoredEventsRef.current = [];
    setShowStimulus(false);
    setResponded(false);
    setIsPaused(false);
    setTrialIndex(0);
    setPracticeEvents([]);
    setLastPracticeEvent(null);
    setPracticeMetrics(null);
    setRunSummary(null);
  }, [clearTrialTimers]);

  const handleStartPractice = useCallback(() => {
    resetRunState();
    setMode("practice");
    setShowStimulus(true);
    setPhase("active");
    focusRespondRef.current = true;
  }, [resetRunState]);

  const handleStartScored = useCallback(() => {
    resetRunState();
    setMode("scored");
    setShowStimulus(true);
    setPhase("active");
    focusRespondRef.current = true;
  }, [resetRunState]);

  const handleReturnToIntro = useCallback(() => {
    resetRunState();
    setMode("practice");
    setPhase("intro");
  }, [resetRunState]);

  const handleResponse = useCallback(() => {
    if (
      phase !== "active" ||
      isPaused ||
      respondedRef.current ||
      finishedRef.current
    ) {
      return;
    }

    const elapsed = performance.now() - trialStartedAtRef.current;
    respondedRef.current = true;
    reactionTimeRef.current = Math.max(0, Math.round(elapsed));
    setResponded(true);
  }, [phase, isPaused]);

  const handlePause = useCallback(() => {
    if (phase !== "active" || isPaused || finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    clearTrialTimers();
    setShowStimulus(false);
    setIsPaused(true);
  }, [phase, isPaused, clearTrialTimers]);

  const handleResume = useCallback(() => {
    if (phase !== "active" || !isPaused) {
      return;
    }

    focusRespondRef.current = true;
    setResponded(false);
    setLastPracticeEvent(null);
    setShowStimulus(true);
    setIsPaused(false);
  }, [phase, isPaused]);

  const finishTrial = useCallback(() => {
    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    clearTrialTimers();

    const activeTrials =
      mode === "practice" ? CPT_PRACTICE_TRIALS : CPT_SCORED_TRIALS;
    const trial = activeTrials[trialIndex];

    if (!trial) {
      return;
    }

    const event = createCptTrialEvent(trial, trialIndex, {
      responded: respondedRef.current,
      reactionTimeMs: reactionTimeRef.current,
    });

    if (mode === "practice") {
      const nextEvents = [...practiceEventsRef.current, event];
      practiceEventsRef.current = nextEvents;
      setPracticeEvents(nextEvents);
      setShowStimulus(false);
      setLastPracticeEvent(event);
      setPhase("practice-feedback");
      return;
    }

    const nextEvents = [...scoredEventsRef.current, event];
    scoredEventsRef.current = nextEvents;
    setShowStimulus(false);

    if (trialIndex >= activeTrials.length - 1) {
      const summary = saveCptRun({
        participantId,
        mode: "scored",
        events: nextEvents,
      });
      setRunSummary(summary);
      setPhase("summary");
      return;
    }

    setResponded(false);
    setLastPracticeEvent(null);
    setShowStimulus(true);
    setTrialIndex(trialIndex + 1);
  }, [clearTrialTimers, mode, trialIndex, saveCptRun, participantId]);

  const handleContinuePractice = useCallback(() => {
    if (trialIndex >= CPT_PRACTICE_TRIALS.length - 1) {
      setPracticeMetrics(calculateCptMetrics(practiceEventsRef.current));
      setPhase("practice-summary");
      return;
    }

    setResponded(false);
    setLastPracticeEvent(null);
    setShowStimulus(true);
    setTrialIndex(trialIndex + 1);
    setPhase("active");
    focusRespondRef.current = true;
  }, [trialIndex]);

  useEffect(() => {
    if (phase !== "active" || isPaused) {
      return;
    }

    const activeTrials =
      mode === "practice" ? CPT_PRACTICE_TRIALS : CPT_SCORED_TRIALS;
    const trial = activeTrials[trialIndex];

    if (!trial) {
      return;
    }

    clearTrialTimers();
    trialStartedAtRef.current = performance.now();
    respondedRef.current = false;
    reactionTimeRef.current = null;
    finishedRef.current = false;

    stimulusTimerRef.current = window.setTimeout(() => {
      setShowStimulus(false);
      stimulusTimerRef.current = null;
    }, CPT_STIMULUS_DURATION_MS);

    trialTimerRef.current = window.setTimeout(() => {
      trialTimerRef.current = null;
      finishTrial();
    }, CPT_RESPONSE_WINDOW_MS);

    return () => {
      clearTrialTimers();
    };
  }, [
    phase,
    mode,
    trialIndex,
    isPaused,
    clearTrialTimers,
    finishTrial,
  ]);

  useEffect(() => {
    if (phase === "active" && !isPaused && focusRespondRef.current) {
      focusRespondRef.current = false;
      respondButtonRef.current?.focus();
    }
  }, [phase, isPaused]);

  useEffect(() => {
    if (isPaused) {
      resumeButtonRef.current?.focus();
    }
  }, [isPaused]);

  useEffect(() => {
    if (phase === "practice-feedback") {
      continueButtonRef.current?.focus();
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "active") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!isPaused) {
          event.preventDefault();
          handlePause();
        }
        return;
      }

      if (event.code !== "Space" || event.repeat) {
        return;
      }

      const target = event.target;

      if (
        target instanceof HTMLElement &&
        target.closest(
          "button, a, input, textarea, select, [contenteditable='true']",
        )
      ) {
        return;
      }

      event.preventDefault();

      if (isPaused) {
        handleResume();
      } else {
        handleResponse();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [phase, isPaused, handlePause, handleResume, handleResponse]);

  useEffect(() => {
    return () => {
      clearTrialTimers();
    };
  }, [clearTrialTimers]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Continuous Performance Task"
        description="A short visual sustained-attention exercise. Watch for the target letter, respond with Space or the Respond button, and review a trial-by-trial demo summary."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" dot>
              Demo activity
            </Badge>
            <span className="text-xs text-ink-subtle">
              Target {CPT_TARGET_STIMULUS} · {CPT_SCORED_TRIALS.length} scored
              trials · in-memory results
            </span>
          </div>
        }
        actions={
          <ButtonLink href="/participant/activities" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Activity library
          </ButtonLink>
        }
      />

      {storageMode === "memory" ? (
        <DemoNotice meta={participantDemoMeta} />
      ) : (
        <Alert tone="warning" title="CPT demonstration task">
          The task and scoring run in the browser. If cloud sync is enabled,
          summary metrics and CPT session metadata may be stored in Firebase;
          raw trial events and EEG files are not uploaded.
        </Alert>
      )}

      <Alert tone="warning" title="Not a clinical assessment">
        This CPT is a frontend demonstration of a visual attention task. It is
        not clinically validated, does not produce a diagnosis, and does not
        send data to a server.
      </Alert>

      {phase === "intro" ? (
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Before you begin</CardTitle>
              <CardDescription>
                Complete the practice run first. The scored run follows the same
                rules without per-trial feedback.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 font-mono text-xs font-semibold text-brand-800">
                    1
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">
                      Watch one letter at a time
                    </p>
                    <p className="mt-0.5 text-sm leading-6 text-ink-muted">
                      Each trial shows a single letter for a short window. Most
                      letters are not the target.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 font-mono text-xs font-semibold text-brand-800">
                    2
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">
                      Respond only to {CPT_TARGET_STIMULUS}
                    </p>
                    <p className="mt-0.5 text-sm leading-6 text-ink-muted">
                      Press Space or use the Respond button when the target
                      appears. Withhold a response for every other letter.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 font-mono text-xs font-semibold text-brand-800">
                    3
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">
                      Review the practice, then start scored
                    </p>
                    <p className="mt-0.5 text-sm leading-6 text-ink-muted">
                      Practice has {CPT_PRACTICE_TRIALS.length} trials with
                      feedback. The scored run has {CPT_SCORED_TRIALS.length}{" "}
                      trials. In Firebase mode, only summary fields sync when
                      the account preference is enabled; otherwise the run is
                      held in browser memory.
                    </p>
                  </div>
                </li>
              </ol>

              <Alert tone="info" title="Keep the page focused">
                The task uses timed trials. Avoid switching tabs during a run.
                Pausing cancels the current trial and restarts it on resume.
              </Alert>
            </CardContent>

            <CardFooter className="flex-wrap">
              <Button onClick={handleStartPractice}>
                <Play aria-hidden="true" className="size-4" />
                Start {CPT_PRACTICE_TRIALS.length}-trial practice
              </Button>
              <ButtonLink href="/participant/activities" variant="outline">
                Back to library
              </ButtonLink>
            </CardFooter>
          </Card>

          <CptRunDetails />
        </div>
      ) : null}

      {phase === "active" ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>{isPractice ? "Practice run" : "Scored run"}</CardTitle>
              <CardDescription>
                Trial {trialIndex + 1} of {totalTrials}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge tone={isPractice ? "neutral" : "brand"}>
                {isPractice ? "Practice" : "Scored"}
              </Badge>
              {isPaused ? (
                <Badge tone="warning" dot>
                  Paused
                </Badge>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <Progress
              value={trialIndex}
              max={totalTrials}
              label="Trials completed"
            />

            <div className="relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-ink/10 bg-ink px-6 py-10 text-center">
              <p className="sr-only" aria-live="polite">
                {isPaused
                  ? "Activity paused."
                  : showStimulus && currentTrial
                    ? `Letter ${currentTrial.stimulus}.`
                    : "Wait for the next letter."}
              </p>

              {isPaused ? (
                <div className="flex flex-col items-center gap-4">
                  <span className="flex size-12 items-center justify-center rounded-full bg-white/10 text-white">
                    <Pause aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-white">Paused</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-white/55">
                      The current trial was cancelled. Resuming restarts it from
                      the beginning.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      ref={resumeButtonRef}
                      variant="inverse"
                      onClick={handleResume}
                    >
                      <Play aria-hidden="true" className="size-4" />
                      Resume
                    </Button>
                    <Button
                      variant="outline-inverse"
                      onClick={handleReturnToIntro}
                    >
                      End session
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
                    {isPractice ? "Practice" : "Scored"} · {trialIndex + 1}/
                    {totalTrials}
                  </p>
                  <p
                    aria-hidden="true"
                    className={cn(
                      "mt-3 font-mono text-7xl font-semibold leading-none text-white transition-opacity",
                      showStimulus ? "opacity-100" : "opacity-25",
                    )}
                  >
                    {showStimulus && currentTrial
                      ? currentTrial.stimulus
                      : "·"}
                  </p>
                  <p className="mt-4 text-sm text-white/55">
                    {showStimulus
                      ? `Respond only if this letter is ${CPT_TARGET_STIMULUS}`
                      : "Hold your response"}
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                ref={respondButtonRef}
                size="lg"
                onClick={handleResponse}
                disabled={responded || isPaused}
                aria-keyshortcuts="Space"
                className="sm:min-w-48"
              >
                <Target aria-hidden="true" className="size-4" />
                {responded ? "Response recorded" : "Respond"}
              </Button>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handlePause}
                  disabled={isPaused}
                >
                  <Pause aria-hidden="true" className="size-4" />
                  Pause
                </Button>
                <Button variant="ghost" onClick={handleReturnToIntro}>
                  End session
                </Button>
              </div>
            </div>

            <p className="text-xs leading-5 text-ink-subtle">
              Press Space to respond. Escape pauses. A paused trial is not
              recorded, and resuming restarts the current trial.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {phase === "practice-feedback" &&
      lastPracticeEvent &&
      practiceFeedback ? (
        <Card>
          <CardHeader>
            <CardTitle>Practice feedback</CardTitle>
            <CardDescription>
              Trial {trialIndex + 1} of {CPT_PRACTICE_TRIALS.length}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-xl border border-line bg-slate-50/60 p-5">
              <Badge tone={practiceFeedback.tone}>
                {practiceFeedback.label}
              </Badge>
              <p className="mt-3 text-sm leading-6 text-ink-muted">
                {practiceFeedback.description}
              </p>
              <p className="mt-2 text-xs leading-5 text-ink-subtle">
                Stimulus {lastPracticeEvent.stimulus} ·{" "}
                {lastPracticeEvent.isTarget ? "Target" : "Non-target"} ·{" "}
                {lastPracticeEvent.reactionTimeMs !== null
                  ? `${lastPracticeEvent.reactionTimeMs} ms reaction time`
                  : "No response recorded"}
              </p>
            </div>

            <p className="text-sm leading-6 text-ink-muted">
              Practice feedback appears after each trial. The scored run uses
              the same timing but does not show per-trial feedback.
            </p>
          </CardContent>

          <CardFooter className="flex-wrap">
            <Button variant="outline" onClick={handleReturnToIntro}>
              End practice
            </Button>
            <Button ref={continueButtonRef} onClick={handleContinuePractice}>
              {trialIndex >= CPT_PRACTICE_TRIALS.length - 1
                ? "View practice summary"
                : "Continue practice"}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {phase === "practice-summary" && practiceMetrics ? (
        <CptSummary
          title="Practice complete"
          description="You completed the practice run. Review the trial outcomes, then start the scored task when you are ready."
          mode="practice"
          metrics={practiceMetrics}
          events={practiceEvents}
          storageMode={storageMode}
          cloudSyncEnabled={cloudSyncEnabled}
          actions={
            <>
              <Button onClick={handleStartScored}>
                Start scored task
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
              <Button variant="outline" onClick={handleStartPractice}>
                <RotateCcw aria-hidden="true" className="size-4" />
                Practice again
              </Button>
              <ButtonLink href="/participant/activities" variant="ghost">
                Back to library
              </ButtonLink>
            </>
          }
        />
      ) : null}

      {phase === "summary" && runSummary ? (
        <>
          {storageMode === "firebase" && !cloudSyncEnabled ? (
            <Alert tone="info" title="This run is not synchronized">
              Cloud sync is off. This run remains in browser memory and will not
              be uploaded later automatically. Enable synchronization before
              future runs to save summary fields.
            </Alert>
          ) : null}
          <CptSummary
            title="Scored run complete"
            description={
              storageMode === "firebase" && cloudSyncEnabled
                ? "The scored run is complete. Summary metrics and CPT session metadata are eligible for account sync; raw trial events stay in the browser."
                : "The scored run is complete. Its browser summary resets on reload unless cloud sync was enabled before the run."
            }
            mode="scored"
            metrics={runSummary}
            events={runSummary.events}
            savedRunId={runSummary.id}
            storageMode={storageMode}
            cloudSyncEnabled={cloudSyncEnabled}
            persistenceStatus={persistenceStatus}
            persistenceMessage={persistenceMessage}
            onSaveReport={
              storageMode === "firebase" && cloudSyncEnabled
                ? () => firebaseAuth.saveReportSummary(runSummary)
                : undefined
            }
            actions={
              <>
                <Button onClick={handleStartScored}>
                  <RotateCcw aria-hidden="true" className="size-4" />
                  Run scored task again
                </Button>
                <Button variant="outline" onClick={handleStartPractice}>
                  Practice again
                </Button>
                <ButtonLink
                  href={`/participant/activities/history/${runSummary.id}`}
                  variant="outline"
                >
                  View run details
                  <ArrowRight aria-hidden="true" className="size-4" />
                </ButtonLink>
                <ButtonLink href="/participant/activities" variant="ghost">
                  Back to library
                </ButtonLink>
              </>
            }
          />
        </>
      ) : null}

      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3.5 text-xs leading-5 text-ink-subtle">
        <Timer aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>
          The CPT uses a deterministic sequence of{" "}
          {CPT_SCORED_TRIALS.length} scored trials with{" "}
          {CPT_SCORED_TRIALS.filter((trial) => trial.isTarget).length} target
          trials. It is included for interface demonstration and research
          prototyping only.
        </p>
      </div>
    </div>
  );
}
