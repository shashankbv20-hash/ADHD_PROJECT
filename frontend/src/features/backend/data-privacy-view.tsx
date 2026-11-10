"use client";

import { ArrowLeft, Download, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useBackendSync } from "@/features/backend/backend-sync-provider";
import { ResearchConsentCard } from "@/features/backend/research-consent-card";
import { ERASURE_CONFIRMATION_PHRASE, type AccessLogEntry } from "@/lib/backend/audit";
import type { DataErasureResult } from "@/lib/backend/types";
import { formatDateTime } from "@/lib/utils";

function triggerDownload(filename: string, json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ExportCard() {
  const { exportData, subjectId, status } = useBackendSync();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    setDone(null);

    try {
      const { filename, json } = await exportData();
      triggerDownload(filename, json);
      setDone(filename);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The export could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Download my data</CardTitle>
        <CardDescription>
          A JSON file with everything the research backend stores for you: consent records, sessions,
          trial-by-trial events, check-ins, summaries, Digital Twin versions, reports and the access
          log. Nothing else is collected — no EEG files, webcam video or messages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          onClick={() => void handleExport()}
          disabled={busy || !subjectId || status !== "ready"}
        >
          <Download aria-hidden="true" className="size-4" />
          {busy ? "Preparing download…" : "Download my data (JSON)"}
        </Button>
        {!subjectId && status === "ready" ? (
          <p className="text-xs text-ink-subtle">
            Nothing is stored for you yet. A record is created only when you first grant research
            consent.
          </p>
        ) : null}
        {done ? (
          <p role="status" className="text-xs text-ink-subtle">
            Downloaded {done}. The export itself is recorded in your access log.
          </p>
        ) : null}
        {error ? (
          <Alert tone="danger" title="Export failed">
            {error}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AccessLogCard() {
  const { loadAccessLog, subjectId, status } = useBackendSync();
  const [entries, setEntries] = useState<AccessLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setEntries(await loadAccessLog());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The access log could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [loadAccessLog]);

  useEffect(() => {
    if (status === "ready" && subjectId) {
      // Fetching remote data when the page opens is the purpose of this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load();
    }
  }, [load, status, subjectId]);

  const foreign = entries?.filter((entry) => entry.attention) ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Access log</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            disabled={loading || !subjectId}
          >
            <RefreshCw aria-hidden="true" className="size-3.5" />
            Refresh
          </Button>
        </div>
        <CardDescription>
          Recorded actions about your data: consent changes, views, exports and erasure. Other
          accounts are shown only as &ldquo;another account&rdquo;.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!subjectId && status === "ready" ? (
          <p className="text-sm text-ink-muted">No activity is recorded until you grant consent.</p>
        ) : null}
        {loading && !entries ? (
          <p role="status" className="text-xs text-ink-subtle">
            Loading the access log…
          </p>
        ) : null}
        {error ? (
          <Alert tone="danger" title="Access log unavailable">
            {error}
          </Alert>
        ) : null}
        {foreign.length > 0 ? (
          <Alert tone="warning" title="Another account tried to reach this record">
            {foreign.length} recorded event{foreign.length === 1 ? "" : "s"} below{" "}
            {foreign.length === 1 ? "was" : "were"} not made by your account. These attempts were
            refused unless the entry says otherwise.
          </Alert>
        ) : null}
        <ul className="space-y-1.5">
          {entries?.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-xs text-ink-muted"
            >
              <span className="font-medium text-ink">{entry.label}</span>
              <span className="flex items-center gap-2">
                <Badge tone={entry.byYou ? "outline" : "warning"}>
                  {entry.byYou ? "You" : "Another account"}
                </Badge>
                <span className="font-mono text-ink-subtle">
                  {entry.at ? `${formatDateTime(entry.at)} UTC` : "—"}
                </span>
              </span>
            </li>
          ))}
        </ul>
        {entries && entries.length === 0 ? (
          <p className="text-sm text-ink-muted">No events recorded.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ErasureCard() {
  const { eraseData, subjectId, status } = useBackendSync();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DataErasureResult | null>(null);
  const inputId = useId();
  const confirmed = typed === ERASURE_CONFIRMATION_PHRASE;

  async function handleErase() {
    if (!confirmed) return;

    setBusy(true);
    setError(null);

    try {
      setResult(await eraseData());
      setTyped("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The data could not be erased.");
    } finally {
      setBusy(false);
    }
  }

  const deletedTotal = result
    ? Object.values(result.deletedDocumentCounts).reduce((total, count) => total + count, 0)
    : 0;

  return (
    <Card className="border-danger/40">
      <CardHeader>
        <CardTitle>Erase my research data</CardTitle>
        <CardDescription>
          Permanently deletes the sessions, trial events, check-ins, summaries, Digital Twin versions
          and reports the research backend holds for you, and withdraws your research consent first so
          nothing new is saved. This cannot be undone — download your data first if you want a copy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-ink-muted">
          <li>
            <span className="font-medium text-ink">Kept:</span> your account, a record that consent was
            given and withdrawn, and the access log (no content).
          </li>
          <li>
            <span className="font-medium text-ink">Not affected:</span> older summaries saved directly
            to your Firebase account, and runs shown in this browser tab until you reload.
          </li>
          <li>You can grant consent again later and start fresh.</li>
        </ul>

        <div className="space-y-2">
          <Label htmlFor={inputId}>
            Type <span className="font-mono">{ERASURE_CONFIRMATION_PHRASE}</span> to confirm
          </Label>
          <Input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={busy || !subjectId}
            aria-invalid={typed.length > 0 && !confirmed}
          />
        </div>

        <Button
          variant="danger"
          onClick={() => void handleErase()}
          disabled={!confirmed || busy || !subjectId || status !== "ready"}
        >
          <Trash2 aria-hidden="true" className="size-4" />
          {busy ? "Erasing…" : "Permanently erase my research data"}
        </Button>

        {!subjectId && status === "ready" ? (
          <p className="text-xs text-ink-subtle">Nothing is stored for you yet, so there is nothing to erase.</p>
        ) : null}

        {error ? (
          <Alert tone="danger" title="Erasure did not complete">
            {error} It is safe to try again; nothing is repeated twice.
          </Alert>
        ) : null}

        {result ? (
          <Alert tone="success" title="Your research data was erased">
            {deletedTotal} stored record{deletedTotal === 1 ? "" : "s"} deleted
            {result.withdrawnConsentCount > 0 ? " and your research consent was withdrawn" : ""} on{" "}
            {formatDateTime(result.erasedAt)} UTC. The access log shows this action.
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DataPrivacyView() {
  const sync = useBackendSync();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Data & privacy"
        description="See, download or erase what the research backend stores about you, and control research consent. These controls apply to data saved with your consent; they do not cover other accounts' data."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" dot>
              Research backend
            </Badge>
            <Badge tone={sync.consent.status === "granted" ? "success" : "outline"}>
              {sync.consent.status === "granted" ? "Consent granted" : "No active consent"}
            </Badge>
          </div>
        }
        actions={
          <ButtonLink href="/participant" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Account overview
          </ButtonLink>
        }
      />

      {sync.status === "error" ? (
        <Alert tone="danger" title="The research backend could not be reached">
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

      <ResearchConsentCard />

      <div className="grid gap-4 xl:grid-cols-2">
        <ExportCard />
        <AccessLogCard />
      </div>

      <ErasureCard />
    </div>
  );
}
