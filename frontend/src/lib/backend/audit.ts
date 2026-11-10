import type { BackendAuditEvent } from "@/lib/backend/types";

/** Plain-language labels for actions the backend records. Unknown actions are humanized. */
const ACTION_LABELS: Record<string, string> = {
  consent_granted: "Research consent granted",
  consent_withdrawn: "Research consent withdrawn",
  subject_data_exported: "Data export downloaded",
  subject_data_erased: "Research data erased",
  access_log_read: "Access log viewed",
  subject_progress_read: "Progress viewed",
  activity_summaries_read: "Activity summaries viewed",
  digital_twin_read: "Digital Twin viewed",
  digital_twin_history_read: "Digital Twin history viewed",
  digital_twin_rebuilt: "Digital Twin updated",
  reports_read: "Reports viewed",
  report_created: "Report created",
  sessions_list_read: "Session list viewed",
  session_read: "Session viewed",
  session_summaries_read: "Session summaries viewed",
  session_created: "Session created",
  session_completed: "Session completed",
  activity_events_ingested: "Trial events saved",
  activity_completed: "Activity completed",
  activity_skipped: "Activity skipped",
  feeling_checkin_recorded: "Check-in recorded",
  subject_access_denied: "Access to this record was refused",
  subject_access_not_found: "A lookup for this record found nothing",
};

export function humanizeAction(action: string): string {
  const known = ACTION_LABELS[action];
  if (known) return known;

  const words = action.replaceAll("_", " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Unknown action";
}

export interface AccessLogEntry {
  id: string;
  label: string;
  rawAction: string;
  at: string | null;
  /** True when this account performed the action; false for any other account. */
  byYou: boolean;
  /** True for events that suggest another account tried to reach this record. */
  attention: boolean;
}

export function parseAuditEvent(event: BackendAuditEvent): AccessLogEntry {
  return {
    id: event.id,
    label: humanizeAction(event.action),
    rawAction: event.action,
    at: event.createdAt,
    byYou: event.actorIsYou,
    attention: !event.actorIsYou,
  };
}

export const ERASURE_CONFIRMATION_PHRASE = "ERASE MY DATA";

export function exportFilename(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `attune-data-export-${stamp}.json`;
}
