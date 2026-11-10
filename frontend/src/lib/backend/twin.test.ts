import { describe, expect, it } from "vitest";

import { parseServerReport, parseServerTwin, parseTwinHistory } from "@/lib/backend/twin";
import type {
  BackendDigitalTwin,
  BackendDigitalTwinHistoryItem,
  BackendReport,
} from "@/lib/backend/types";

const twin = (profile: Record<string, unknown>, overrides: Partial<BackendDigitalTwin> = {}): BackendDigitalTwin => ({
  subjectId: "s",
  version: 3,
  status: "available",
  profile,
  qualityFlags: [],
  updatedAt: "2026-01-02T00:00:00Z",
  ...overrides,
});

describe("parseServerTwin", () => {
  it("reads the snake_case profile into a typed view", () => {
    const view = parseServerTwin(
      twin({
        summary_count: 3,
        metrics: {
          accuracy_percent: 88,
          mean_hit_reaction_time_ms: 402,
          hit_count: 17,
          miss_count: 1,
          false_alarm_count: 2,
          correct_rejection_count: 52,
          trial_count: 72,
          summary_count: 3,
        },
        baseline: { summary_id: "a", completed_at: "2026-01-01T00:00:00Z" },
        latest: { summary_id: "c", completed_at: "2026-01-03T00:00:00Z" },
        change: { accuracy_delta_percentage_points: 4.5, mean_hit_reaction_time_delta_ms: -18 },
        observation_start: "2026-01-01T00:00:00Z",
        observation_end: "2026-01-03T00:00:00Z",
        data_provenance: "frontend-cpt-demo-derived-v1",
      }),
    );

    expect(view).toMatchObject({
      version: 3,
      status: "available",
      summaryCount: 3,
      accuracyDeltaPoints: 4.5,
      meanHitReactionTimeDeltaMs: -18,
      baselineAt: "2026-01-01T00:00:00Z",
      latestAt: "2026-01-03T00:00:00Z",
      dataProvenance: "frontend-cpt-demo-derived-v1",
    });
    expect(view.metrics).toMatchObject({ accuracyPercent: 88, meanHitReactionTimeMs: 402, hitCount: 17, summaryCount: 3 });
  });

  it("represents an empty Twin without inventing values", () => {
    const view = parseServerTwin(
      twin(
        {
          status: "insufficient_data",
          summary_count: 0,
          metrics: null,
          baseline: null,
          latest: null,
          change: null,
          observation_start: null,
          observation_end: null,
        },
        { version: 0, status: "insufficient_data", updatedAt: null, qualityFlags: ["no_eligible_observations"] },
      ),
    );

    expect(view).toMatchObject({
      version: 0,
      summaryCount: 0,
      metrics: null,
      accuracyDeltaPoints: null,
      baselineAt: null,
      observationStart: null,
      qualityFlags: ["no_eligible_observations"],
    });
  });

  it("turns wrong-typed or missing fields into null instead of guessing", () => {
    const view = parseServerTwin(
      twin({
        summary_count: "three",
        metrics: { accuracy_percent: "high", mean_hit_reaction_time_ms: Number.NaN },
        change: { accuracy_delta_percentage_points: null },
        baseline: "nope",
      }),
    );

    expect(view.summaryCount).toBe(0);
    expect(view.metrics).toMatchObject({ accuracyPercent: null, meanHitReactionTimeMs: null });
    expect(view.accuracyDeltaPoints).toBeNull();
    expect(view.baselineAt).toBeNull();
  });

  it("tolerates a profile that is not an object", () => {
    expect(parseServerTwin(twin(null as unknown as Record<string, unknown>)).summaryCount).toBe(0);
  });
});

describe("parseTwinHistory", () => {
  const item = (version: number, sources: string[], accuracy: unknown): BackendDigitalTwinHistoryItem => ({
    id: `h${version}`,
    subjectId: "s",
    version,
    sourceSummaryIds: sources,
    snapshot: { metrics: { accuracy_percent: accuracy } },
    qualityFlags: [],
    algorithmVersion: "cpt-descriptive-twin-v1",
    createdAt: `2026-01-0${version}T00:00:00Z`,
  });

  it("sorts newest version first and counts source runs", () => {
    const entries = parseTwinHistory([item(1, ["a"], 80), item(3, ["a", "b", "c"], 90), item(2, ["a", "b"], 85)]);

    expect(entries.map((entry) => entry.version)).toEqual([3, 2, 1]);
    expect(entries[0]).toMatchObject({ sourceCount: 3, accuracyPercent: 90 });
  });

  it("uses null for an unreadable accuracy", () => {
    expect(parseTwinHistory([item(1, [], "bad")])[0].accuracyPercent).toBeNull();
  });
});

describe("parseServerReport", () => {
  const report = (content: Record<string, unknown>): BackendReport => ({
    id: "r",
    subjectId: "s",
    sessionId: null,
    reportType: "cpt-summary",
    templateVersion: "cpt-research-summary-v1",
    content,
    createdAt: "2026-01-04T00:00:00Z",
  });

  it("reads counts, metrics and limitations", () => {
    const view = parseServerReport(
      report({
        summary_count: 2,
        metrics: { accuracy_percent: 91, mean_hit_reaction_time_ms: 395 },
        limitations: ["Descriptive CPT task metrics only.", 42, "Not a diagnosis."],
      }),
    );

    expect(view).toMatchObject({ id: "r", summaryCount: 2, templateVersion: "cpt-research-summary-v1" });
    expect(view.metrics?.accuracyPercent).toBe(91);
    expect(view.limitations).toEqual(["Descriptive CPT task metrics only.", "Not a diagnosis."]);
  });

  it("copes with empty content", () => {
    const view = parseServerReport(report({}));
    expect(view).toMatchObject({ summaryCount: null, metrics: null, limitations: [] });
  });
});
