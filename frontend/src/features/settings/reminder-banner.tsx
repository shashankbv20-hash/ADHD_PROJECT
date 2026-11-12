"use client";

import { Bell, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import {
  isReminderDue,
  parseReminder,
  REMINDER_STORAGE_KEY,
  todayKey,
} from "@/lib/preferences/reminders";

const DISMISSED_KEY = "attune.reminder.dismissed.v1";

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * In-app practice reminder. Shows only while the app is open, when the person's own schedule says
 * a reminder is due and they have not practised or dismissed it today. If they allowed browser
 * notifications it also raises one notification per day while the page is open.
 */
export function ReminderBanner() {
  const { cptRuns } = useActivitySessions();
  const [due, setDue] = useState(false);

  const latestRun = cptRuns.reduce<Date | null>((latest, run) => {
    const completed = new Date(run.completedAt);
    return Number.isFinite(completed.getTime()) && (!latest || completed > latest) ? completed : latest;
  }, null);
  const latestRunTime = latestRun?.getTime() ?? null;

  useEffect(() => {
    function check() {
      const now = new Date();
      const nextDue = isReminderDue(parseReminder(readStorage(REMINDER_STORAGE_KEY)), now, {
        lastPracticeAt: latestRunTime === null ? null : new Date(latestRunTime),
        dismissedDay: readStorage(DISMISSED_KEY),
      });
      setDue(nextDue);

      const notifiedKey = `attune.reminder.notified.${todayKey(now)}`;
      if (
        nextDue &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        readStorage(notifiedKey) === null
      ) {
        try {
          window.localStorage.setItem(notifiedKey, "1");
          new Notification("Time for a short practice", {
            body: "Your reminder is due. A practice session takes about three minutes.",
          });
        } catch {
          // Notifications are optional; the banner still shows.
        }
      }
    }

    check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [latestRunTime]);

  if (!due) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, todayKey(new Date()));
    } catch {
      // Without storage the banner returns on the next check; harmless.
    }
    setDue(false);
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900"
    >
      <Bell aria-hidden="true" className="size-4 shrink-0" />
      <span className="flex-1">It is time for your planned practice.</span>
      <ButtonLink href="/participant/activities/cpt" size="sm">
        Start now
      </ButtonLink>
      <button
        type="button"
        onClick={dismiss}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium underline underline-offset-2"
      >
        <X aria-hidden="true" className="size-3.5" />
        Dismiss for today
      </button>
    </div>
  );
}
