import type { NBackRunView, GoNoGoRunView } from "@/lib/backend/summary-mapping";
import type { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import type { ObjectTrackingSummary } from "@/features/activities/object-tracking/object-tracking-scoring";
import type { PlanningPuzzleSummary } from "@/features/activities/planning-puzzle/planning-puzzle-scoring";
import type { StopSignalSummary } from "@/features/activities/stop-signal/stop-signal-scoring";
import type { StroopSummary } from "@/features/activities/stroop/stroop-scoring";
import type { TaskSwitchingSummary } from "@/features/activities/task-switching/task-switching-scoring";
import type { TimePerceptionSummary } from "@/features/activities/time-perception/time-perception-scoring";
import type { VisualSearchSummary } from "@/features/activities/visual-search/visual-search-scoring";
import type { VisualSequenceSummary } from "@/features/activities/visual-sequence/visual-sequence-scoring";
import type { CptMetrics } from "@/types";

/**
 * One place that says, for each activity, which columns its results history shows and how a run becomes
 * a row. A run comes either from the research backend (server-calculated views) or, when the app is not
 * connected to it, from the browser-session log written by each activity when a scored run finishes.
 */
export type ResultActivityId =
  | "go-no-go"
  | "stop-signal"
  | "n-back"
  | "stroop"
  | "task-switching"
  | "visual-search"
  | "planning-puzzle"
  | "visual-sequence"
  | "time-perception"
  | "multiple-object-tracking";

/** The backend sync state, which holds each activity's saved runs. */
type BackendSync = NonNullable<ReturnType<typeof useOptionalBackendSync>>;

/** Local summary shapes, as each activity computes them right after a run. */
export interface NBackLocalSummary {
  metrics: CptMetrics;
  oneBackAccuracy: number | null;
  twoBackAccuracy: number | null;
}

export interface LocalSummaries {
  "go-no-go": CptMetrics;
  "stop-signal": StopSignalSummary;
  "n-back": NBackLocalSummary;
  stroop: StroopSummary;
  "task-switching": TaskSwitchingSummary;
  "visual-search": VisualSearchSummary;
  "planning-puzzle": PlanningPuzzleSummary;
  "visual-sequence": VisualSequenceSummary;
  "time-perception": TimePerceptionSummary;
  "multiple-object-tracking": ObjectTrackingSummary;
}

export interface ResultRow {
  id: string;
  at: string;
  cells: string[];
}

export interface ActivityResultsDefinition {
  id: ResultActivityId;
  title: string;
  href: string;
  columns: string[];
  /** Server-saved runs for this activity, newest first. */
  fromServer: (sync: BackendSync) => ResultRow[];
}

const num = (value: number | null, suffix = "") => (value === null ? "—" : `${value}${suffix}`);
const signed = (value: number | null, suffix = "") =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value}${suffix}`;
const of = (part: number, whole: number) => `${part} of ${whole}`;

export const ACTIVITY_RESULTS: ActivityResultsDefinition[] = [
  {
    id: "go-no-go",
    title: "Go / No-Go",
    href: "/participant/activities/go-no-go",
    columns: ["Accuracy", "Correct go", "Missed go", "Pressed on no-go", "Held back", "Mean go time"],
    fromServer: (sync) =>
      sync.goNoGoRuns.map((run: GoNoGoRunView) => ({
        id: run.id,
        at: run.completedAt,
        cells: [
          num(run.accuracyPercent, "%"),
          String(run.correctGo),
          String(run.omissions),
          String(run.commissions),
          String(run.correctHoldBack),
          num(run.meanGoReactionTimeMs, " ms"),
        ],
      })),
  },
  {
    id: "stop-signal",
    title: "Stop-Signal",
    href: "/participant/activities/stop-signal",
    columns: ["Go accuracy", "Mean go time", "Stop success", "Mean stop delay", "SSRT"],
    fromServer: (sync) =>
      sync.stopSignalRuns.map((run) => ({
        id: run.id,
        at: run.completedAt,
        cells: [
          num(run.goAccuracyPercent, "%"),
          num(run.meanGoReactionTimeMs, " ms"),
          num(run.stopSuccessRatePercent, "%"),
          num(run.meanStopSignalDelayMs, " ms"),
          run.ssrtEstimateMs === null ? "—" : `${run.ssrtEstimateMs} ms${run.ssrtReliable ? "" : " (unreliable)"}`,
        ],
      })),
  },
  {
    id: "n-back",
    title: "N-back",
    href: "/participant/activities/n-back",
    columns: ["Accuracy", "1-back", "2-back", "Matches found", "Missed", "False alarms"],
    fromServer: (sync) =>
      sync.nBackRuns.map((run: NBackRunView) => ({
        id: run.id,
        at: run.completedAt,
        cells: [
          num(run.accuracyPercent, "%"),
          num(run.oneBackAccuracyPercent, "%"),
          num(run.twoBackAccuracyPercent, "%"),
          String(run.hits),
          String(run.misses),
          String(run.falseAlarms),
        ],
      })),
  },
  {
    id: "stroop",
    title: "Stroop",
    href: "/participant/activities/stroop",
    columns: ["Accuracy", "Agree", "Conflict", "Interference", "Wrong", "No answer"],
    fromServer: (sync) =>
      sync.stroopRuns.map((run) => ({
        id: run.id,
        at: run.completedAt,
        cells: [
          num(run.accuracyPercent, "%"),
          num(run.congruentAccuracyPercent, "%"),
          num(run.incongruentAccuracyPercent, "%"),
          num(run.interferenceMs, " ms"),
          String(run.errors),
          String(run.omissions),
        ],
      })),
  },
  {
    id: "task-switching",
    title: "Task Switching",
    href: "/participant/activities/task-switching",
    columns: ["Accuracy", "Repeat", "Switch", "Switch cost", "Wrong", "No answer"],
    fromServer: (sync) =>
      sync.taskSwitchingRuns.map((run) => ({
        id: run.id,
        at: run.completedAt,
        cells: [
          num(run.accuracyPercent, "%"),
          num(run.repeatAccuracyPercent, "%"),
          num(run.switchAccuracyPercent, "%"),
          num(run.switchCostMs, " ms"),
          String(run.errors),
          String(run.omissions),
        ],
      })),
  },
  {
    id: "visual-search",
    title: "Visual Search",
    href: "/participant/activities/visual-search",
    columns: ["Accuracy", "Mean time", "Search slope", "Wrong", "No answer"],
    fromServer: (sync) =>
      sync.visualSearchRuns.map((run) => ({
        id: run.id,
        at: run.completedAt,
        cells: [
          num(run.accuracyPercent, "%"),
          num(run.meanReactionTimeMs, " ms"),
          num(run.searchSlopeMsPerItem, " ms/item"),
          String(run.errors),
          String(run.omissions),
        ],
      })),
  },
  {
    id: "planning-puzzle",
    title: "Planning Puzzle",
    href: "/participant/activities/planning-puzzle",
    columns: ["Solved", "Extra moves", "Illegal tries", "Planning time"],
    fromServer: (sync) =>
      sync.planningPuzzleRuns.map((run) => ({
        id: run.id,
        at: run.completedAt,
        cells: [
          of(run.solvedCount, run.puzzleCount),
          num(run.meanExtraMoves),
          String(run.illegalAttempts),
          run.meanPlanningTimeMs === null ? "—" : `${(run.meanPlanningTimeMs / 1000).toFixed(1)} s`,
        ],
      })),
  },
  {
    id: "visual-sequence",
    title: "Visual Sequence Memory",
    href: "/participant/activities/visual-sequence",
    columns: ["Correct", "Longest span", "Squares in right place"],
    fromServer: (sync) =>
      sync.visualSequenceRuns.map((run) => ({
        id: run.id,
        at: run.completedAt,
        cells: [
          of(run.correctCount, run.trialCount),
          num(run.longestCorrectSpan),
          num(run.correctPositionPercent, "%"),
        ],
      })),
  },
  {
    id: "time-perception",
    title: "Time Perception",
    href: "/participant/activities/time-perception",
    columns: ["Close (within 20%)", "Average error", "Tendency", "Average ratio"],
    fromServer: (sync) =>
      sync.timePerceptionRuns.map((run) => ({
        id: run.id,
        at: run.completedAt,
        cells: [
          of(run.withinToleranceCount, run.trialCount),
          num(run.meanAbsoluteErrorMs, " ms"),
          signed(run.meanSignedErrorMs, " ms"),
          num(run.meanRatio),
        ],
      })),
  },
  {
    id: "multiple-object-tracking",
    title: "Multiple Object Tracking",
    href: "/participant/activities/multiple-object-tracking",
    columns: ["Perfect trials", "Circles found", "Most tracked"],
    fromServer: (sync) =>
      sync.objectTrackingRuns.map((run) => ({
        id: run.id,
        at: run.completedAt,
        cells: [
          of(run.perfectCount, run.trialCount),
          num(run.targetsFoundPercent, "%"),
          num(run.highestPerfectLoad),
        ],
      })),
  },
];

/** The same cells, from the summary an activity computes in the browser right after a run. */
export const LOCAL_CELLS: { [K in ResultActivityId]: (summary: LocalSummaries[K]) => string[] } = {
  "go-no-go": (m) => [
    num(m.accuracyPercent, "%"),
    String(m.hitCount),
    String(m.missCount),
    String(m.falseAlarmCount),
    String(m.correctRejectionCount),
    num(m.meanHitReactionTimeMs, " ms"),
  ],
  "stop-signal": (s) => [
    num(s.goAccuracyPercent, "%"),
    num(s.meanGoReactionTimeMs, " ms"),
    num(s.stopSuccessRatePercent, "%"),
    num(s.meanStopSignalDelayMs, " ms"),
    s.ssrtEstimateMs === null ? "—" : `${s.ssrtEstimateMs} ms${s.ssrtReliable ? "" : " (unreliable)"}`,
  ],
  "n-back": (r) => [
    num(r.metrics.accuracyPercent, "%"),
    num(r.oneBackAccuracy, "%"),
    num(r.twoBackAccuracy, "%"),
    String(r.metrics.hitCount),
    String(r.metrics.missCount),
    String(r.metrics.falseAlarmCount),
  ],
  stroop: (s) => [
    num(s.accuracyPercent, "%"),
    num(s.congruentAccuracyPercent, "%"),
    num(s.incongruentAccuracyPercent, "%"),
    num(s.interferenceMs, " ms"),
    String(s.errorCount),
    String(s.omissionCount),
  ],
  "task-switching": (s) => [
    num(s.accuracyPercent, "%"),
    num(s.repeatAccuracyPercent, "%"),
    num(s.switchAccuracyPercent, "%"),
    num(s.switchCostMs, " ms"),
    String(s.errorCount),
    String(s.omissionCount),
  ],
  "visual-search": (s) => [
    num(s.accuracyPercent, "%"),
    num(s.meanReactionTimeMs, " ms"),
    num(s.searchSlopeMsPerItem, " ms/item"),
    String(s.errorCount),
    String(s.omissionCount),
  ],
  "planning-puzzle": (s) => [
    of(s.solvedCount, s.puzzleCount),
    num(s.meanExtraMoves),
    String(s.illegalAttempts),
    s.meanPlanningTimeMs === null ? "—" : `${(s.meanPlanningTimeMs / 1000).toFixed(1)} s`,
  ],
  "visual-sequence": (s) => [
    of(s.correctCount, s.trialCount),
    num(s.longestCorrectSpan),
    num(s.correctPositionPercent, "%"),
  ],
  "time-perception": (s) => [
    of(s.withinToleranceCount, s.trialCount),
    num(s.meanAbsoluteErrorMs, " ms"),
    signed(s.meanSignedErrorMs, " ms"),
    num(s.meanRatio),
  ],
  "multiple-object-tracking": (s) => [
    of(s.perfectCount, s.trialCount),
    num(s.targetsFoundPercent, "%"),
    num(s.highestPerfectLoad),
  ],
};
