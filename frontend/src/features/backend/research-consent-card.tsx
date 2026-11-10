"use client";

import { useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import { useBackendSync } from "@/features/backend/backend-sync-provider";
import {
  RESEARCH_CONSENT_DRAFT,
  RESEARCH_CONSENT_IS_DRAFT,
} from "@/lib/backend/consent";

/**
 * Explicit research-consent control for API-backed mode. Consent is only ever
 * granted by the participant pressing the button after ticking the agreement;
 * nothing grants it implicitly. The wording is a DRAFT placeholder.
 */
export function ResearchConsentCard() {
  const sync = useBackendSync();
  const { unsyncedRunCount, retryUnsyncedRuns } = useActivitySessions();
  const [agreed, setAgreed] = useState(false);
  const agreementId = useId();
  const granted = sync.consent.status === "granted";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{RESEARCH_CONSENT_DRAFT.title}</CardTitle>
          {granted ? <Badge tone="success">Consent granted</Badge> : <Badge tone="outline">Not granted</Badge>}
        </div>
        <CardDescription>{RESEARCH_CONSENT_DRAFT.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {RESEARCH_CONSENT_IS_DRAFT ? (
          <Alert tone="warning" title="Draft placeholder wording">
            This text has not been approved by the research team, an ethics
            board, or legal counsel. It exists to test the consent mechanism and
            must be replaced before real participants use it.
          </Alert>
        ) : null}

        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink-muted">
          {RESEARCH_CONSENT_DRAFT.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        {sync.status === "loading" ? (
          <p role="status" className="text-xs text-ink-subtle">
            Checking consent status…
          </p>
        ) : null}

        {sync.status === "error" ? (
          <Alert tone="danger" title="Consent status unavailable">
            {sync.loadError}{" "}
            <button
              type="button"
              onClick={() => void sync.refresh()}
              className="font-medium underline underline-offset-2"
            >
              Try again
            </button>
          </Alert>
        ) : null}

        {sync.status === "ready" && !granted ? (
          <div className="space-y-3">
            <label
              htmlFor={agreementId}
              className="flex items-start gap-3 rounded-lg border border-line p-4 text-sm leading-6 text-ink-muted"
            >
              <input
                id={agreementId}
                type="checkbox"
                checked={agreed}
                disabled={sync.consentBusy}
                onChange={(event) => setAgreed(event.target.checked)}
                className="mt-1 size-4 shrink-0 rounded border-line-strong accent-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              />
              <span className="font-medium text-ink">{RESEARCH_CONSENT_DRAFT.agreementLabel}</span>
            </label>
            <Button
              onClick={() => void sync.grantConsent()}
              disabled={!agreed || sync.consentBusy}
            >
              {sync.consentBusy ? "Saving consent…" : "Grant consent"}
            </Button>
          </div>
        ) : null}

        {sync.status === "ready" && granted ? (
          <div className="space-y-3">
            <p className="text-sm leading-6 text-ink-muted">
              Scored CPT runs are now saved to the research backend. You can
              withdraw at any time; this stops future saving.
            </p>
            <Button
              variant="outline"
              onClick={() => void sync.withdrawConsent()}
              disabled={sync.consentBusy}
            >
              {sync.consentBusy ? "Updating…" : "Withdraw consent"}
            </Button>
          </div>
        ) : null}

        {sync.consentError ? (
          <Alert tone="danger" title="Consent was not changed">
            {sync.consentError}
          </Alert>
        ) : null}

        {unsyncedRunCount > 0 ? (
          <Alert
            tone="info"
            title={`${unsyncedRunCount} scored run${unsyncedRunCount === 1 ? " is" : "s are"} not saved yet`}
          >
            {granted
              ? "They stay in this browser session until saved."
              : "They stay in this browser session and will be saved if you grant consent."}{" "}
            {granted ? (
              <button
                type="button"
                onClick={retryUnsyncedRuns}
                className="font-medium underline underline-offset-2"
              >
                Retry saving now
              </button>
            ) : null}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
