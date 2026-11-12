import type {
  BackendDigitalTwin,
  BackendDigitalTwinHistoryItem,
  BackendReport,
} from "@/lib/backend/types";

/**
 * The backend returns the Twin `profile` and report `content` as free-form
 * objects whose inner keys stay snake_case (only the envelope is camelCased).
 * These parsers read them defensively into typed view models: anything missing
 * or of the wrong type becomes `null` rather than being guessed.
 */

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export interface ServerAggregateMetrics {
  trialCount: number | null;
  hitCount: number | null;
  missCount: number | null;
  falseAlarmCount: number | null;
  correctRejectionCount: number | null;
  accuracyPercent: number | null;
  meanHitReactionTimeMs: number | null;
  summaryCount: number | null;
}

function parseAggregate(value: unknown): ServerAggregateMetrics | null {
  const metrics = asRecord(value);
  if (!metrics) return null;

  return {
    trialCount: asNumber(metrics.trial_count),
    hitCount: asNumber(metrics.hit_count),
    missCount: asNumber(metrics.miss_count),
    falseAlarmCount: asNumber(metrics.false_alarm_count),
    correctRejectionCount: asNumber(metrics.correct_rejection_count),
    accuracyPercent: asNumber(metrics.accuracy_percent),
    meanHitReactionTimeMs: asNumber(metrics.mean_hit_reaction_time_ms),
    summaryCount: asNumber(metrics.summary_count),
  };
}

export type TwinConfidence = "insufficient" | "low" | "moderate" | "higher";

export interface TwinTrendPoint {
  run: number;
  completedAt: string | null;
  accuracyPercent: number | null;
  meanHitReactionTimeMs: number | null;
  reactionTimeSdMs: number | null;
  reactionTimeCv: number | null;
}

export interface TwinBlockPoint {
  block: number;
  runs: number;
  accuracyPercent: number | null;
  meanHitReactionTimeMs: number | null;
}

/** Twin v2 insights. Every part is null/empty when the server had too little data. */
export interface ServerTwinInsights {
  confidence: TwinConfidence;
  runCount: number;
  trend: TwinTrendPoint[];
  blockProfile: TwinBlockPoint[];
  spread: { runsUsed: number; meanSdMs: number | null; meanCv: number | null } | null;
  withinSession: {
    runsUsed: number;
    accuracyChangePoints: number | null;
    reactionTimeChangeMs: number | null;
  } | null;
}

const CONFIDENCE_LEVELS: readonly TwinConfidence[] = ["insufficient", "low", "moderate", "higher"];

function asArray(value: unknown): Json[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is Json => item !== null)
    : [];
}

/** Older (v1) Twin versions have no insights: this returns null for them. */
export function parseInsights(profile: Json): ServerTwinInsights | null {
  const insights = asRecord(profile.insights);
  if (!insights) return null;

  const confidence = CONFIDENCE_LEVELS.find((level) => level === insights.confidence) ?? "insufficient";
  const spread = asRecord(insights.reaction_time_spread);
  const within = asRecord(insights.within_session_change);

  return {
    confidence,
    runCount: asNumber(insights.run_count) ?? 0,
    trend: asArray(insights.trend).map((point) => ({
      run: asNumber(point.run) ?? 0,
      completedAt: asString(point.completed_at),
      accuracyPercent: asNumber(point.accuracy_percent),
      meanHitReactionTimeMs: asNumber(point.mean_hit_reaction_time_ms),
      reactionTimeSdMs: asNumber(point.reaction_time_sd_ms),
      reactionTimeCv: asNumber(point.reaction_time_cv),
    })),
    blockProfile: asArray(insights.block_profile).map((block) => ({
      block: asNumber(block.block) ?? 0,
      runs: asNumber(block.runs) ?? 0,
      accuracyPercent: asNumber(block.accuracy_percent),
      meanHitReactionTimeMs: asNumber(block.mean_hit_reaction_time_ms),
    })),
    spread: spread
      ? {
          runsUsed: asNumber(spread.runs_used) ?? 0,
          meanSdMs: asNumber(spread.mean_sd_ms),
          meanCv: asNumber(spread.mean_cv),
        }
      : null,
    withinSession: within
      ? {
          runsUsed: asNumber(within.runs_used) ?? 0,
          accuracyChangePoints: asNumber(within.accuracy_change_points),
          reactionTimeChangeMs: asNumber(within.reaction_time_change_ms),
        }
      : null,
  };
}

export interface ServerTwinView {
  version: number;
  status: "available" | "insufficient_data";
  summaryCount: number;
  metrics: ServerAggregateMetrics | null;
  baselineAt: string | null;
  latestAt: string | null;
  accuracyDeltaPoints: number | null;
  meanHitReactionTimeDeltaMs: number | null;
  observationStart: string | null;
  observationEnd: string | null;
  qualityFlags: string[];
  dataProvenance: string | null;
  updatedAt: string | null;
  /** Null for Twin versions calculated before v2. */
  insights: ServerTwinInsights | null;
}

export function parseServerTwin(twin: BackendDigitalTwin): ServerTwinView {
  const profile = asRecord(twin.profile) ?? {};
  const change = asRecord(profile.change);

  return {
    version: twin.version,
    status: twin.status,
    summaryCount: asNumber(profile.summary_count) ?? 0,
    metrics: parseAggregate(profile.metrics),
    baselineAt: asString(asRecord(profile.baseline)?.completed_at),
    latestAt: asString(asRecord(profile.latest)?.completed_at),
    accuracyDeltaPoints: asNumber(change?.accuracy_delta_percentage_points),
    meanHitReactionTimeDeltaMs: asNumber(change?.mean_hit_reaction_time_delta_ms),
    observationStart: asString(profile.observation_start),
    observationEnd: asString(profile.observation_end),
    qualityFlags: twin.qualityFlags,
    dataProvenance: asString(profile.data_provenance),
    updatedAt: twin.updatedAt,
    insights: parseInsights(profile),
  };
}

export interface ServerTwinHistoryEntry {
  id: string;
  version: number;
  createdAt: string;
  sourceCount: number;
  algorithmVersion: string;
  accuracyPercent: number | null;
}

export function parseTwinHistory(items: readonly BackendDigitalTwinHistoryItem[]): ServerTwinHistoryEntry[] {
  return items
    .map((item) => ({
      id: item.id,
      version: item.version,
      createdAt: item.createdAt,
      sourceCount: item.sourceSummaryIds.length,
      algorithmVersion: item.algorithmVersion,
      accuracyPercent: parseAggregate(asRecord(item.snapshot)?.metrics)?.accuracyPercent ?? null,
    }))
    .sort((left, right) => right.version - left.version);
}

export interface ServerReportView {
  id: string;
  createdAt: string;
  templateVersion: string;
  summaryCount: number | null;
  metrics: ServerAggregateMetrics | null;
  limitations: string[];
}

export function parseServerReport(report: BackendReport): ServerReportView {
  const content = asRecord(report.content) ?? {};
  const limitations = Array.isArray(content.limitations)
    ? content.limitations.filter((item): item is string => typeof item === "string")
    : [];

  return {
    id: report.id,
    createdAt: report.createdAt,
    templateVersion: report.templateVersion,
    summaryCount: asNumber(content.summary_count),
    metrics: parseAggregate(content.metrics),
    limitations,
  };
}
