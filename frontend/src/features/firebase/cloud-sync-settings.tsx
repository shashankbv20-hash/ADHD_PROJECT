"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";

export function CloudSyncSettings() {
  const { account, setCloudSyncEnabled } = useFirebaseAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = account?.profile.cloudSyncEnabled ?? false;
  // Non-null in API-backed mode, where scored CPT runs follow research consent instead.
  const apiBacked = useOptionalBackendSync() !== null;

  async function handleChange(nextEnabled: boolean) {
    setSaving(true);
    setError(null);

    try {
      await setCloudSyncEnabled(nextEnabled);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The cloud synchronization setting could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account data synchronization</CardTitle>
        <CardDescription>
          {apiBacked
            ? "Scored CPT runs are saved through the research backend and follow the research consent above, not this setting. This setting only controls saved report summaries stored in your Firebase account."
            : "This setting controls optional application data stored in your Firebase account. Authentication and the required participant profile are managed separately."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-start gap-3 rounded-lg border border-line p-4 text-sm leading-6 text-ink-muted">
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving || !account}
            onChange={(event) => void handleChange(event.target.checked)}
            aria-describedby="firebase-sync-explanation"
            className="mt-1 size-4 shrink-0 rounded border-line-strong accent-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          />
          <span className="font-medium text-ink">
            Save future activity summaries and application session metadata to
            my Firebase account.
          </span>
        </label>

        <div id="firebase-sync-explanation" className="space-y-2">
          <p className="text-xs leading-5 text-ink-subtle">
            {apiBacked
              ? "When enabled, saved report summaries are stored under this authenticated UID in Firebase. Scored CPT runs, including their trial events, are handled by the research backend under your research consent instead."
              : "When enabled, completed CPT summaries, CPT application-session metadata, saved report summaries, and the supported Digital Twin snapshot are stored under this authenticated UID. Raw trial events, response timelines, EEG files, and EEG signals are not uploaded."}
          </p>
          <p className="text-xs leading-5 text-ink-subtle">
            Turning sync off stops future writes; it does not delete data already
            stored in Firestore. This setting is not formal research consent,
            guardian consent, or child assent.
          </p>
        </div>

        {saving ? (
          <p role="status" className="text-xs text-ink-subtle">
            Updating account preference…
          </p>
        ) : null}
        {error ? (
          <Alert tone="danger" title="Sync preference was not changed">
            {error}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
