import { describe, expect, it } from "vitest";
import {
  DEFAULT_REMINDER,
  isReminderDue,
  isValidTime,
  parseReminder,
  serializeReminder,
  todayKey,
  type ReminderPreference,
} from "./reminders";

// 2026-03-04 is a Wednesday (getDay() === 3).
const at = (hours: number, minutes = 0, day = 4) => new Date(2026, 2, day, hours, minutes);
const enabled: ReminderPreference = { enabled: true, days: [3], time: "17:00" };

describe("parseReminder", () => {
  it("falls back to defaults for missing, malformed or wrong-shaped data", () => {
    for (const raw of [null, "", "{", "null", "42", '"x"']) {
      expect(parseReminder(raw)).toEqual(DEFAULT_REMINDER);
    }
  });

  it("round-trips a valid preference", () => {
    const preference: ReminderPreference = { enabled: true, days: [0, 6], time: "08:30" };
    expect(parseReminder(serializeReminder(preference))).toEqual(preference);
  });

  it("sanitizes days and time", () => {
    const parsed = parseReminder(JSON.stringify({ enabled: "yes", days: [6, 1, 1, 9, -1, 2.5, "3"], time: "25:99" }));
    expect(parsed).toEqual({ enabled: false, days: [1, 6], time: DEFAULT_REMINDER.time });
  });
});

describe("isValidTime", () => {
  it("accepts HH:MM only", () => {
    expect(["00:00", "09:05", "23:59"].every(isValidTime)).toBe(true);
    expect(["24:00", "9:05", "12:60", "", "12:5"].some(isValidTime)).toBe(false);
  });
});

describe("isReminderDue", () => {
  it("is never due when disabled or no days are chosen", () => {
    expect(isReminderDue({ ...enabled, enabled: false }, at(18))).toBe(false);
    expect(isReminderDue({ ...enabled, days: [] }, at(18))).toBe(false);
  });

  it("is due only on chosen days and after the chosen time", () => {
    expect(isReminderDue(enabled, at(16, 59))).toBe(false);
    expect(isReminderDue(enabled, at(17, 0))).toBe(true);
    expect(isReminderDue(enabled, at(23, 59))).toBe(true);
    expect(isReminderDue(enabled, at(18, 0, 5))).toBe(false); // Thursday
  });

  it("is not due after practising or dismissing today, but is again tomorrow", () => {
    expect(isReminderDue(enabled, at(18), { lastPracticeAt: at(9) })).toBe(false);
    expect(isReminderDue(enabled, at(18), { dismissedDay: todayKey(at(18)) })).toBe(false);
    expect(isReminderDue(enabled, at(18), { lastPracticeAt: new Date(2026, 2, 3, 20) })).toBe(true);
    expect(isReminderDue({ ...enabled, days: [3, 4] }, at(18, 0, 5), { dismissedDay: todayKey(at(18)) })).toBe(true);
  });

  it("treats an invalid stored time as not due", () => {
    expect(isReminderDue({ ...enabled, time: "nope" }, at(18))).toBe(false);
  });
});
