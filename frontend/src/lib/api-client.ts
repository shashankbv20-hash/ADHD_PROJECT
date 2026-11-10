export type ApiClientErrorKind =
  | "configuration"
  | "not-configured"
  | "contract-unconfirmed"
  | "unsupported"
  | "network"
  | "http"
  | "invalid-response"
  | "invalid-request"
  | "cancelled";

export class ApiClientError extends Error {
  readonly kind: ApiClientErrorKind;
  readonly status?: number;
  readonly code?: string;
  /** Machine-readable code from the backend error envelope (e.g. "consent_required"). */
  readonly backendCode?: string;
  /** Backend request ID, safe to show to users for support. */
  readonly requestId?: string;

  constructor(
    message: string,
    options: {
      kind: ApiClientErrorKind;
      status?: number;
      code?: string;
      backendCode?: string;
      requestId?: string;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiClientError";
    this.kind = options.kind;
    this.status = options.status;
    this.code = options.code;
    this.backendCode = options.backendCode;
    this.requestId = options.requestId;
  }
}

/** Compatibility class for existing unsupported-capability service states. */
export class ServiceUnavailableError extends ApiClientError {
  constructor(
    message = "This capability is not available in the current frontend prototype.",
    kind: "not-configured" | "contract-unconfirmed" | "unsupported" =
      "unsupported",
  ) {
    super(message, { kind });
    this.name = "ServiceUnavailableError";
  }
}

/** Compatibility class for HTTP failures; response bodies are intentionally omitted. */
export class ApiError extends ApiClientError {
  constructor(
    message: string,
    status: number,
    code?: string,
    details: { backendCode?: string; requestId?: string } = {},
  ) {
    super(message, { kind: "http", status, code, ...details });
    this.name = "ApiError";
  }
}

export type ApiHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions {
  method?: ApiHttpMethod;
  headers?: HeadersInit;
  /** Serialized as JSON. Binary and multipart upload are deliberately unsupported. */
  body?: unknown;
  signal?: AbortSignal;
}

export interface ApiClientOptions {
  baseUrl: string | null;
  fetcher?: typeof fetch;
  configurationError?: string;
}

export interface ApiClient {
  requestJson<Payload>(
    path: string,
    options?: ApiRequestOptions,
  ): Promise<Payload>;
}

const JSON_CONTENT_TYPE = /^application\/(?:[\w.-]+\+)?json\b/i;

function resolveRequestUrl(baseUrl: string, path: string): URL {
  let base: URL;

  try {
    base = new URL(baseUrl);
  } catch (cause) {
    throw new ApiClientError("The API base URL is invalid.", {
      kind: "configuration",
      code: "invalid-api-base-url",
      cause,
    });
  }

  const relativePath = path.replace(/^\/+/, "");
  let url: URL;

  try {
    url = new URL(relativePath, `${base.toString().replace(/\/$/, "")}/`);
  } catch (cause) {
    throw new ApiClientError("The API request path is invalid.", {
      kind: "invalid-request",
      code: "invalid-request-path",
      cause,
    });
  }

  if (url.origin !== base.origin) {
    throw new ApiClientError("The API request path must be relative to the configured base URL.", {
      kind: "invalid-request",
      code: "cross-origin-request-path",
    });
  }

  return url;
}

const BACKEND_CODE = /^[a-z0-9_]{1,64}$/;
const REQUEST_ID = /^[A-Za-z0-9-]{1,64}$/;

/**
 * Extracts only the machine code and request ID from the backend error
 * envelope `{ error: { code, message, requestId } }`. The free-text message is
 * deliberately never copied, so server text cannot reach the UI unreviewed.
 */
async function readErrorEnvelope(
  response: globalThis.Response,
): Promise<{ backendCode?: string; requestId?: string }> {
  try {
    const body: unknown = await response.json();
    const envelope = (body as { error?: Record<string, unknown> } | null)?.error;
    const backendCode = envelope?.code;
    const requestId = envelope?.requestId;

    return {
      backendCode:
        typeof backendCode === "string" && BACKEND_CODE.test(backendCode)
          ? backendCode
          : undefined,
      requestId:
        typeof requestId === "string" && REQUEST_ID.test(requestId)
          ? requestId
          : undefined,
    };
  } catch {
    return {};
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export function createApiClient({
  baseUrl,
  fetcher = globalThis.fetch,
  configurationError,
}: ApiClientOptions): ApiClient {
  return {
    async requestJson<Payload>(
      path: string,
      options: ApiRequestOptions = {},
    ): Promise<Payload> {
      if (configurationError) {
        throw new ApiClientError(configurationError, {
          kind: "configuration",
          code: "invalid-frontend-configuration",
        });
      }

      if (!baseUrl) {
        throw new ServiceUnavailableError(
          "No active remote API base URL is configured. Select remote mode and set NEXT_PUBLIC_API_BASE_URL after a backend base URL is confirmed.",
          "not-configured",
        );
      }

      const url = resolveRequestUrl(baseUrl, path);
      const headers = new Headers(options.headers);
      headers.set("Accept", "application/json");

      let body: string | undefined;

      if (options.body !== undefined) {
        try {
          body = JSON.stringify(options.body);
        } catch (cause) {
          throw new ApiClientError("The request body could not be serialized as JSON.", {
            kind: "invalid-request",
            code: "json-serialization-failed",
            cause,
          });
        }

        if (body === undefined) {
          throw new ApiClientError(
            "The request body did not produce a JSON value.",
            { kind: "invalid-request", code: "empty-json-serialization" },
          );
        }

        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
      }

      const method = options.method ?? (body === undefined ? "GET" : "POST");

      if (body !== undefined && method === "GET") {
        throw new ApiClientError("GET requests cannot include a JSON body.", {
          kind: "invalid-request",
          code: "get-request-with-body",
        });
      }

      let response: globalThis.Response;

      try {
        response = await fetcher(url, {
          method,
          headers,
          body,
          signal: options.signal,
          cache: "no-store",
        });
      } catch (cause) {
        if (options.signal?.aborted || isAbortError(cause)) {
          throw new ApiClientError("The API request was cancelled.", {
            kind: "cancelled",
            code: "request-cancelled",
            cause,
          });
        }

        throw new ApiClientError(
          "The API request could not reach the configured service.",
          { kind: "network", code: "network-request-failed", cause },
        );
      }

      if (!response.ok) {
        throw new ApiError(
          `The API request failed with HTTP status ${response.status}.`,
          response.status,
          "http-request-failed",
          await readErrorEnvelope(response),
        );
      }

      if (response.status === 204) {
        return undefined as Payload;
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (!JSON_CONTENT_TYPE.test(contentType)) {
        throw new ApiClientError(
          "The API returned a successful response that was not JSON.",
          { kind: "invalid-response", code: "unexpected-content-type" },
        );
      }

      try {
        return (await response.json()) as Payload;
      } catch (cause) {
        throw new ApiClientError(
          "The API returned a successful response with invalid JSON.",
          { kind: "invalid-response", code: "invalid-json-response", cause },
        );
      }
    },
  };
}
