"use client";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { ApiClientErrorKind } from "@/lib/api-client";

const apiErrorPresentation: Record<
  ApiClientErrorKind,
  { title: string; message: string; tone: "info" | "warning" | "danger" }
> = {
  configuration: {
    title: "Frontend configuration problem",
    message: "Review the public API configuration values and rebuild the frontend.",
    tone: "danger",
  },
  "not-configured": {
    title: "Remote service is not configured",
    message: "No backend request was sent. Use demo mode or configure a confirmed backend base URL.",
    tone: "warning",
  },
  "contract-unconfirmed": {
    title: "Backend contract is not confirmed",
    message: "No request was sent because the endpoint mapping or response contract is not documented.",
    tone: "warning",
  },
  unsupported: {
    title: "Capability unavailable",
    message: "This operation is not supported by the selected frontend provider.",
    tone: "info",
  },
  network: {
    title: "Service could not be reached",
    message: "Check service availability and network access, then retry if appropriate.",
    tone: "danger",
  },
  http: {
    title: "Service request failed",
    message: "The service returned an unsuccessful HTTP response. Response details were not exposed.",
    tone: "danger",
  },
  "invalid-response": {
    title: "Service response could not be read",
    message: "The response was not valid JSON or did not use a JSON content type.",
    tone: "danger",
  },
  "invalid-request": {
    title: "Request could not be prepared",
    message: "Review the request configuration and try again.",
    tone: "danger",
  },
  cancelled: {
    title: "Request cancelled",
    message: "No further action was taken for this request.",
    tone: "info",
  },
};

export function ApiErrorNotice({
  kind,
  status,
  onRetry,
}: {
  kind: ApiClientErrorKind;
  status?: number;
  onRetry?: () => void;
}) {
  const presentation = apiErrorPresentation[kind];

  return (
    <Alert tone={presentation.tone} title={presentation.title}>
      <p>{presentation.message}</p>
      {status ? (
        <p className="mt-1 font-mono text-xs">HTTP status: {status}</p>
      ) : null}
      {onRetry && kind !== "cancelled" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onRetry}
        >
          Retry request
        </Button>
      ) : null}
    </Alert>
  );
}
