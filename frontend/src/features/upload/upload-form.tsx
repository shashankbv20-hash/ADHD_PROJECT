"use client";

import {
  FileUp,
  LoaderCircle,
  UploadCloud,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FieldError,
  FieldHint,
  Label,
  Select,
} from "@/components/ui/input";
import { useDemoSessions } from "@/features/upload/demo-session-store";
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_EXTENSIONS,
  MAX_FILE_SIZE_LABEL,
  formatFileSize,
  getFileExtension,
  validateDemoEegFile,
} from "@/features/upload/validation";
import { cn } from "@/lib/utils";

const protocolOptions = [
  "Resting state, eyes open",
  "Resting state, eyes closed",
  "Continuous performance task",
  "Working memory challenge",
  "Other / not specified",
] as const;

export function UploadForm() {
  const router = useRouter();
  const { createSession } = useDemoSessions();
  const inputRef = useRef<HTMLInputElement>(null);
  const preparationTimerRef = useRef<number | null>(null);
  const resolvePreparationRef = useRef<(() => void) | null>(null);
  const isPreparingRef = useRef(false);
  const preparationCancelledRef = useRef(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [protocol, setProtocol] = useState<string>(protocolOptions[0]);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [isDragging, setIsDragging] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);

  useEffect(
    () => () => {
      preparationCancelledRef.current = true;

      if (preparationTimerRef.current !== null) {
        window.clearTimeout(preparationTimerRef.current);
        preparationTimerRef.current = null;
      }

      const resolvePreparation = resolvePreparationRef.current;
      resolvePreparationRef.current = null;
      resolvePreparation?.();
    },
    [],
  );

  function handleSelectedFile(selectedFile: File) {
    const error = validateDemoEegFile(selectedFile);

    if (error) {
      setFile(null);
      setFileError(error);
      return;
    }

    setFile(selectedFile);
    setFileError(undefined);
    setFormError(undefined);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.item(0);

    if (selectedFile) {
      handleSelectedFile(selectedFile);
    }

    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const droppedFile = event.dataTransfer.files.item(0);

    if (droppedFile) {
      handleSelectedFile(droppedFile);
    }
  }

  function clearFile() {
    setFile(null);
    setFileError(undefined);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function cancelPendingPreparation() {
    preparationCancelledRef.current = true;
    isPreparingRef.current = false;

    if (preparationTimerRef.current !== null) {
      window.clearTimeout(preparationTimerRef.current);
      preparationTimerRef.current = null;
    }

    const resolvePreparation = resolvePreparationRef.current;
    resolvePreparationRef.current = null;
    resolvePreparation?.();

    setIsPreparing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPreparingRef.current) {
      return;
    }

    const nextFileError = file
      ? undefined
      : "Choose a demo EEG file to continue.";
    const nextConsentError = consent
      ? undefined
      : "Acknowledge the demo notice to continue.";

    setFileError(nextFileError);
    setConsentError(nextConsentError);

    if (nextFileError || nextConsentError || !file) {
      return;
    }

    const selectedFile = file;
    setFormError(undefined);
    isPreparingRef.current = true;
    preparationCancelledRef.current = false;
    setIsPreparing(true);

    await new Promise<void>((resolve) => {
      resolvePreparationRef.current = resolve;
      preparationTimerRef.current = window.setTimeout(() => {
        preparationTimerRef.current = null;
        resolvePreparationRef.current = null;
        resolve();
      }, 450);
    });

    if (preparationCancelledRef.current) {
      return;
    }

    try {
      const session = createSession({
        fileName: selectedFile.name,
        fileSizeBytes: selectedFile.size,
        fileExtension: getFileExtension(selectedFile.name),
        protocol,
      });

      router.push(`/participant/upload/processing/${session.id}`);
    } catch {
      isPreparingRef.current = false;
      setFormError("The demo session could not be created. Try again.");
      setIsPreparing(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Select a demo EEG file</CardTitle>
          <CardDescription>
            This form checks file metadata only. The selected file is never
            read, uploaded, or stored.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {formError ? (
              <Alert tone="danger" title="Unable to prepare demo session">
                {formError}
              </Alert>
            ) : null}

            <div className="space-y-1.5">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
                  isDragging
                    ? "border-brand-500 bg-brand-50"
                    : "border-line-strong bg-slate-50/60",
                )}
              >
                <span className="mx-auto flex size-11 items-center justify-center rounded-full border border-line bg-surface text-brand-700 shadow-sm">
                  <UploadCloud aria-hidden="true" className="size-5" />
                </span>
                <p className="mt-3 text-sm font-medium text-ink">
                  Drag and drop a demo EEG file
                </p>
                <p
                  id="upload-file-help"
                  className="mx-auto mt-1 max-w-sm text-xs leading-5 text-ink-subtle"
                >
                  CSV, EDF, or BDF up to {MAX_FILE_SIZE_LABEL}. One file at a
                  time. File contents stay in your browser.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => inputRef.current?.click()}
                  disabled={isPreparing}
                  aria-describedby={
                    fileError
                      ? "upload-file-help upload-file-error"
                      : "upload-file-help"
                  }
                >
                  Choose file
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT_ATTRIBUTE}
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="Choose a demo EEG file"
                  aria-invalid={Boolean(fileError)}
                  aria-describedby={
                    fileError
                      ? "upload-file-help upload-file-error"
                      : "upload-file-help"
                  }
                  onChange={handleFileInput}
                  disabled={isPreparing}
                />
              </div>

              {file ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileUp
                      aria-hidden="true"
                      className="size-4 shrink-0 text-brand-700"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {file.name}
                      </p>
                      <p className="text-xs text-ink-subtle">
                        {getFileExtension(file.name).toUpperCase()} -{" "}
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearFile}
                    disabled={isPreparing}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              ) : null}

              {fileError ? (
                <FieldError id="upload-file-error">{fileError}</FieldError>
              ) : (
                <FieldHint>
                  Accepted demo extensions:{" "}
                  {ACCEPTED_EXTENSIONS.join(", ").toUpperCase()}.
                </FieldHint>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="upload-protocol">Recording protocol</Label>
              <Select
                id="upload-protocol"
                name="protocol"
                value={protocol}
                onChange={(event) => setProtocol(event.target.value)}
                disabled={isPreparing}
                aria-describedby="upload-protocol-hint"
              >
                {protocolOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              <FieldHint id="upload-protocol-hint">
                Used only as demo metadata. No task or signal is analyzed.
              </FieldHint>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-start gap-2.5 text-sm leading-6 text-ink-muted">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => {
                    setConsent(event.target.checked);
                    setConsentError(undefined);
                  }}
                  disabled={isPreparing}
                  aria-invalid={Boolean(consentError)}
                  aria-describedby={
                    consentError ? "upload-consent-error" : undefined
                  }
                  className="mt-1 size-4 shrink-0 rounded border-line-strong accent-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                />
                <span>
                  I confirm I have permission to use this synthetic recording
                  and understand that it will not be uploaded, stored, or
                  processed.
                </span>
              </label>
              {consentError ? (
                <FieldError id="upload-consent-error">
                  {consentError}
                </FieldError>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-5">
              <Button type="submit" disabled={isPreparing}>
                {isPreparing ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                ) : (
                  <UploadCloud aria-hidden="true" className="size-4" />
                )}
                {isPreparing
                  ? "Preparing demo session..."
                  : "Continue to demo processing"}
              </Button>
              <ButtonLink
                href="/participant"
                variant="outline"
                onClick={cancelPendingPreparation}
              >
                Cancel
              </ButtonLink>
            </div>
            <p aria-live="polite" className="sr-only">
              {isPreparing ? "Preparing demo session." : ""}
            </p>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>What happens next</CardTitle>
            <CardDescription>
              The workflow previews the intended participant journey without a
              backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {[
                {
                  title: "Client-side checks",
                  detail:
                    "Your browser checks the file name, extension, size, and consent acknowledgement.",
                },
                {
                  title: "Simulated processing",
                  detail:
                    "You advance a demo timeline manually. No preprocessing or analysis job runs.",
                },
                {
                  title: "Session record",
                  detail:
                    "A metadata-only record shows where real quality, artifact, and feature summaries would appear.",
                },
              ].map((item, index) => (
                <li key={item.title} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 font-mono text-xs font-semibold text-brand-700">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-ink-subtle">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Demo requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs leading-5 text-ink-muted">
              <li>CSV, EDF, or BDF file extension.</li>
              <li>Maximum size: {MAX_FILE_SIZE_LABEL}.</li>
              <li>One file at a time.</li>
              <li>Consent acknowledgement before continuing.</li>
              <li>No file contents are read or sent anywhere.</li>
            </ul>
            <Alert tone="warning" title="No real analysis" className="mt-4">
              This prototype does not include upload storage, EEG
              preprocessing, artifact detection, feature extraction, or model
              inference.
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
