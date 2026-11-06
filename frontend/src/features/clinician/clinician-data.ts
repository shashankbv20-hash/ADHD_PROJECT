import type { ClinicianOverview, CptRunSummary } from "@/types";

export interface ClinicianDashboardSummary {
  participantCount: number;
  reviewQueueCount: number;
  recordedSessionCount: number;
  reviewNeededCount: number;
}

export function buildClinicianDashboardSummary(
  overview: ClinicianOverview,
): ClinicianDashboardSummary {
  return {
    participantCount: overview.roster.length,
    reviewQueueCount: overview.reviewQueue.length,
    recordedSessionCount: overview.roster.reduce(
      (total, participant) => total + participant.sessionCount,
      0,
    ),
    reviewNeededCount: overview.roster.filter(
      (participant) => participant.status === "review-needed",
    ).length,
  };
}

export function getParticipantScoredCptRuns(
  runs: readonly CptRunSummary[],
  participantId: string,
): CptRunSummary[] {
  return runs.filter(
    (run) => run.participantId === participantId && run.mode === "scored",
  );
}
