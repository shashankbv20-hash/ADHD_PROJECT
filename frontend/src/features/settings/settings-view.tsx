"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldHint, Input, Label } from "@/components/ui/input";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import {
  DAY_LABELS,
  isValidTime,
  parseReminder,
  REMINDER_STORAGE_KEY,
  serializeReminder,
  type ReminderPreference,
} from "@/lib/preferences/reminders";

const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(REMINDER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function ProfileCard() {
  const { providerMode, account, updateDisplayName } = useFirebaseAuth();
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const inputId = useId();

  const current = account?.profile.displayName ?? "";
  const value = name ?? current;

  if (providerMode !== "firebase" || !account) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your profile can be edited when you are signed in with an account. In demonstration mode
            there is no account to edit.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const trimmed = value.trim();
  const invalid = trimmed.length < 1 || trimmed.length > 120;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await updateDisplayName(trimmed);
      setName(null);
      setMessage({ tone: "success", text: "Your name was updated." });
    } catch (caught) {
      setMessage({
        tone: "danger",
        text: caught instanceof Error ? caught.message : "Your name could not be updated.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          The name shown in the app. Your role is set by your account and cannot be changed here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={inputId}>Display name</Label>
          <Input
            id={inputId}
            value={value}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={invalid}
            disabled={busy}
            autoComplete="name"
          />
          <FieldHint>1 to 120 characters.</FieldHint>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void save()} disabled={busy || invalid || trimmed === current}>
            {busy ? "Saving…" : "Save name"}
          </Button>
          <Badge tone="outline">Role: {account.profile.role}</Badge>
        </div>
        {message ? (
          <Alert tone={message.tone} title={message.tone === "success" ? "Saved" : "Not saved"}>
            {message.text}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RemindersCard() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const preference = parseReminder(raw);
  const timeId = useId();
  const [notice, setNotice] = useState<string | null>(null);
  const notificationsSupported = typeof Notification !== "undefined";
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  function update(next: ReminderPreference) {
    try {
      window.localStorage.setItem(REMINDER_STORAGE_KEY, serializeReminder(next));
      setNotice(null);
    } catch {
      setNotice("Your browser is blocking storage, so this reminder could not be saved on this device.");
    }
    listeners.forEach((listener) => listener());
  }

  function toggleDay(day: number) {
    const days = preference.days.includes(day)
      ? preference.days.filter((item) => item !== day)
      : [...preference.days, day].sort((a, b) => a - b);
    update({ ...preference, days });
  }

  async function allowNotifications() {
    if (!notificationsSupported) return;
    setPermission(await Notification.requestPermission());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice reminders</CardTitle>
        <CardDescription>
          A banner on your overview reminds you to practise on the days and time you choose. It is
          saved on this device only and works while the app is open; nothing is sent to a server and
          no message is sent when the app is closed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="flex items-center gap-3 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={preference.enabled}
            onChange={(event) => update({ ...preference, enabled: event.target.checked })}
            className="size-4 accent-brand-700"
          />
          Remind me to practise
        </label>

        <fieldset className="space-y-2" disabled={!preference.enabled}>
          <legend className="text-sm font-medium text-ink">Days</legend>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, day) => (
              <label
                key={label}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400"
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={preference.days.includes(day)}
                  onChange={() => toggleDay(day)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor={timeId}>Time</Label>
          <Input
            id={timeId}
            type="time"
            value={preference.time}
            disabled={!preference.enabled}
            onChange={(event) => {
              if (isValidTime(event.target.value)) update({ ...preference, time: event.target.value });
            }}
            className="w-40"
          />
        </div>

        <div className="space-y-2 border-t border-line/70 pt-4">
          <p className="text-sm font-medium text-ink">Browser notifications (optional)</p>
          {permission === "unsupported" ? (
            <p className="text-sm text-ink-muted">This browser does not support notifications.</p>
          ) : permission === "granted" ? (
            <p className="text-sm text-ink-muted">
              Allowed. You will also get one notification when a reminder is due while the app is
              open. Change this in your browser&apos;s site settings.
            </p>
          ) : permission === "denied" ? (
            <p className="text-sm text-ink-muted">
              Blocked in this browser. The in-app banner still works; change it in your browser&apos;s
              site settings if you want notifications.
            </p>
          ) : (
            <Button variant="outline" size="sm" onClick={() => void allowNotifications()}>
              Allow notifications
            </Button>
          )}
        </div>

        {notice ? <Alert tone="warning" title="Not saved">{notice}</Alert> : null}
      </CardContent>
    </Card>
  );
}

export function SettingsView() {
  return (
    <div className="space-y-6">
      <ProfileCard />
      <RemindersCard />
    </div>
  );
}
