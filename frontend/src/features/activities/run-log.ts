"use client";

import { useSyncExternalStore } from "react";
import {
  LOCAL_CELLS,
  type LocalSummaries,
  type ResultActivityId,
  type ResultRow,
} from "@/features/activities/activity-results";

/**
 * Browser-session log of finished scored runs, one list per activity. It lets the results history show
 * runs from every activity when the app is not connected to the research backend (demonstration mode).
 * It is held in memory only: a reload clears it. Practice runs are never recorded.
 */
type Log = Partial<Record<ResultActivityId, ResultRow[]>>;

let log: Log = {};
const listeners = new Set<() => void>();
const EMPTY: ResultRow[] = [];

export function recordRun<K extends ResultActivityId>(activity: K, id: string, summary: LocalSummaries[K]): void {
  const row: ResultRow = {
    id,
    at: new Date().toISOString(),
    cells: (LOCAL_CELLS[activity] as (summary: LocalSummaries[K]) => string[])(summary),
  };
  // Newest first; a re-recorded run id replaces the earlier row.
  log = { ...log, [activity]: [row, ...(log[activity] ?? []).filter((existing) => existing.id !== id)] };
  listeners.forEach((listener) => listener());
}

export function clearRunLog(): void {
  log = {};
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** This visit's runs for one activity, newest first. */
export function useRunLog(activity: ResultActivityId): ResultRow[] {
  return useSyncExternalStore(
    subscribe,
    () => log[activity] ?? EMPTY,
    () => EMPTY,
  );
}
