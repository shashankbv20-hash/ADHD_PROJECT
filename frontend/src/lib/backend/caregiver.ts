import type { BackendClient } from "@/lib/backend/client";
import { summaryToCptRun } from "@/lib/backend/summary-mapping";
import {
  parseServerReport,
  parseServerTwin,
  parseTwinHistory,
  type ServerReportView,
  type ServerTwinHistoryEntry,
  type ServerTwinView,
} from "@/lib/backend/twin";
import type { BackendCaregiverRelationship, BackendSharedSubject } from "@/lib/backend/types";
import type { CptRunSummary } from "@/types";

/**
 * Caregiver sharing.
 *
 * A caregiver account is created by the research team (a trusted role claim, never
 * self-assigned). To share, the participant types the caregiver's ID, which the caregiver
 * copies from their own Caregiver page. Caregivers see progress, the Digital Twin, reports
 * and session summaries read-only; they never see trial events, the export, the access log,
 * or any control that changes data.
 */

// Firebase UIDs are alphanumeric (up to 128 chars); allow `-`/`_` for emulator-style IDs.
const CAREGIVER_ID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;

export function validateCaregiverId(value: string): string | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Enter the caregiver's ID.";
  }

  if (!CAREGIVER_ID_PATTERN.test(trimmed)) {
    return "That doesn't look like a caregiver ID. Copy it exactly from the caregiver's own page.";
  }

  return undefined;
}

/** Shows enough of an ID to recognise it without displaying the whole identifier. */
export function maskId(id: string): string {
  return id.length <= 10 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export interface CaregiverShare {
  id: string;
  caregiverIdMasked: string;
  active: boolean;
  since: string;
  revokedAt: string | null;
}

export function parseCaregiverShare(relationship: BackendCaregiverRelationship): CaregiverShare {
  return {
    id: relationship.id,
    caregiverIdMasked: maskId(relationship.caregiverUserId),
    active: relationship.status === "active" && relationship.revokedAt === null,
    since: relationship.createdAt,
    revokedAt: relationship.revokedAt,
  };
}

/** Owner side: manage who can view this subject. */
export function createCaregiverSharing(client: BackendClient) {
  return {
    async list(subjectId: string): Promise<CaregiverShare[]> {
      const { items } = await client.listCaregivers(subjectId);
      return items.map(parseCaregiverShare);
    },

    async share(subjectId: string, caregiverId: string): Promise<CaregiverShare> {
      const problem = validateCaregiverId(caregiverId);
      if (problem) {
        throw new Error(problem);
      }
      return parseCaregiverShare(await client.grantCaregiver(subjectId, caregiverId.trim()));
    },

    async stop(subjectId: string, relationshipId: string): Promise<CaregiverShare> {
      return parseCaregiverShare(await client.revokeCaregiver(subjectId, relationshipId));
    },
  };
}

export interface SharedSubjectView {
  subjectId: string;
  label: string;
  relationshipId: string;
  sharedSince: string | null;
}

export function parseSharedSubject(subject: BackendSharedSubject, position: number): SharedSubjectView {
  return {
    subjectId: subject.subjectId,
    label: subject.displayLabel?.trim() || `Shared participant ${position + 1}`,
    relationshipId: subject.relationshipId,
    sharedSince: subject.sharedSince,
  };
}

export interface CaregiverSubjectData {
  twin: ServerTwinView;
  twinHistory: ServerTwinHistoryEntry[];
  reports: ServerReportView[];
  /** Server-calculated scored runs, newest first. Trial events are never shown to caregivers. */
  runs: CptRunSummary[];
  sessionCount: number;
}

/** Caregiver side: read-only views of shared subjects. */
export function createCaregiverViewer(client: BackendClient) {
  return {
    async listShared(): Promise<SharedSubjectView[]> {
      const { items } = await client.listSharedSubjects();
      return items.map(parseSharedSubject);
    },

    async loadSubject(subjectId: string): Promise<CaregiverSubjectData> {
      const [twin, history, reports, summaries, sessions] = await Promise.all([
        client.getDigitalTwin(subjectId),
        client.listDigitalTwinHistory(subjectId),
        client.listReports(subjectId),
        client.listActivitySummaries(subjectId, { limit: 50 }),
        client.listSessions(subjectId, { limit: 50 }),
      ]);

      return {
        twin: parseServerTwin(twin),
        twinHistory: parseTwinHistory(history.items),
        reports: reports.items.map(parseServerReport),
        // The caregiver is not the subject, so the run's participant is the shared subject.
        runs: summaries.items
          .filter((summary) => summary.activityCode === "cpt")
          .map((summary) => summaryToCptRun(summary, subjectId)),
        sessionCount: sessions.items.length,
      };
    },

    async stopViewing(subjectId: string, relationshipId: string): Promise<void> {
      await client.revokeCaregiver(subjectId, relationshipId);
    },
  };
}
