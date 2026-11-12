/**
 * Practice reminders, stored on this device only (localStorage). There is no server-side
 * scheduler or push delivery: a reminder shows as an in-app banner, and as a browser
 * notification only while the app is open and the person has allowed notifications.
 * Nothing about reminder preferences is sent anywhere.
 */

export interface ReminderPreference {
  enabled: boolean;
  /** 0 = Sunday … 6 = Saturday (same as Date#getDay). */
  days: number[];
  /** 24-hour "HH:MM", local time. */
  time: string;
}

export const REMINDER_STORAGE_KEY = "attune.reminder.v1";
export const DEFAULT_REMINDER: ReminderPreference = {
  enabled: false,
  days: [1, 2, 3, 4, 5],
  time: "17:00",
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** Reads untrusted stored data defensively; anything invalid falls back to the defaults. */
export function parseReminder(raw: string | null): ReminderPreference {
  if (!raw) return DEFAULT_REMINDER;

  try {
    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value !== "object") return DEFAULT_REMINDER;
    const record = value as Record<string, unknown>;
    const days = Array.isArray(record.days)
      ? [...new Set(record.days.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))]
      : DEFAULT_REMINDER.days;

    return {
      enabled: record.enabled === true,
      days: days.sort((a, b) => a - b),
      time: typeof record.time === "string" && isValidTime(record.time) ? record.time : DEFAULT_REMINDER.time,
    };
  } catch {
    return DEFAULT_REMINDER;
  }
}

export function serializeReminder(preference: ReminderPreference): string {
  return JSON.stringify(preference);
}

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * A reminder is due when it is enabled, today is a chosen day, the chosen time has passed, and the
 * person has neither practised nor dismissed it today.
 */
export function isReminderDue(
  preference: ReminderPreference,
  now: Date,
  {
    lastPracticeAt,
    dismissedDay,
  }: { lastPracticeAt?: Date | null; dismissedDay?: string | null } = {},
): boolean {
  if (!preference.enabled || preference.days.length === 0) return false;
  if (!preference.days.includes(now.getDay())) return false;

  const match = TIME_PATTERN.exec(preference.time);
  if (!match) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  if (minutesNow < Number(match[1]) * 60 + Number(match[2])) return false;

  const today = dayKey(now);
  if (dismissedDay === today) return false;
  if (lastPracticeAt && dayKey(lastPracticeAt) === today) return false;
  return true;
}

export function todayKey(now: Date): string {
  return dayKey(now);
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
