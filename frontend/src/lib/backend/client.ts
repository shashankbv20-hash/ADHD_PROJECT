import { ApiClientError, createApiClient } from "@/lib/api-client";
import type {
  BackendActivitySummary,
  BackendActivitySummaryPage,
  BackendCapabilities,
  BackendConsent,
  BackendCptEvent,
  BackendDigitalTwin,
  BackendDigitalTwinHistoryItem,
  BackendProgress,
  BackendReport,
  BackendSession,
  BackendSessionPage,
  BackendSubject,
  BackendUser,
  ConsentCreateRequest,
  EventBatchResponse,
  ReportCreateRequest,
  SessionCreateRequest,
} from "@/lib/backend/types";

/** Thrown by a token provider when no signed-in user can supply an ID token. */
export class AuthTokenUnavailableError extends Error {
  constructor(message = "No signed-in user is available to authorize the request.") {
    super(message);
    this.name = "AuthTokenUnavailableError";
  }
}

export interface BackendClientOptions {
  /** Backend origin, e.g. `https://api.example.test` (no `/api/v1`). */
  baseUrl: string;
  /**
   * Returns a Firebase ID token. `forceRefresh` is true on the single retry
   * after a 401, so an expired token is replaced rather than resent.
   */
  getIdToken: (forceRefresh: boolean) => Promise<string>;
  fetcher?: typeof fetch;
}

const API_PREFIX = "api/v1";

function withBearerToken(
  fetcher: typeof fetch,
  getIdToken: BackendClientOptions["getIdToken"],
): typeof fetch {
  return async (input, init) => {
    const send = async (forceRefresh: boolean) => {
      const token = await getIdToken(forceRefresh);
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return fetcher(input, { ...init, headers });
    };

    const first = await send(false);
    // Request bodies are JSON strings, so a single retry with a fresh token is safe.
    return first.status === 401 ? send(true) : first;
  };
}

export function createBackendClient({
  baseUrl,
  getIdToken,
  fetcher = globalThis.fetch,
}: BackendClientOptions) {
  const http = createApiClient({
    baseUrl,
    fetcher: withBearerToken(fetcher, getIdToken),
  });

  async function request<Payload>(
    path: string,
    options?: Parameters<typeof http.requestJson>[1],
  ): Promise<Payload> {
    try {
      return await http.requestJson<Payload>(`${API_PREFIX}/${path}`, options);
    } catch (error) {
      if (error instanceof ApiClientError && error.cause instanceof AuthTokenUnavailableError) {
        throw new ApiClientError("Sign in to continue.", {
          kind: "configuration",
          code: "auth-token-unavailable",
          cause: error.cause,
        });
      }
      throw error;
    }
  }

  const post = <Payload>(path: string, body?: unknown) =>
    request<Payload>(path, { method: "POST", body: body ?? undefined });

  return {
    getCapabilities: () => request<BackendCapabilities>("capabilities"),
    getMe: () => request<BackendUser>("users/me"),

    listSubjects: () => request<{ items: BackendSubject[] }>("subjects"),
    createSubject: (displayLabel?: string) =>
      post<BackendSubject>("subjects", displayLabel ? { displayLabel } : {}),

    listConsents: (subjectId: string) =>
      request<{ items: BackendConsent[] }>(`subjects/${subjectId}/consents`),
    createConsent: (subjectId: string, body: ConsentCreateRequest) =>
      post<BackendConsent>(`subjects/${subjectId}/consents`, body),
    withdrawConsent: (subjectId: string, consentId: string) =>
      post<BackendConsent>(`subjects/${subjectId}/consents/${consentId}/withdraw`),

    createSession: (body: SessionCreateRequest) => post<BackendSession>("sessions", body),
    getSession: (sessionId: string) => request<BackendSession>(`sessions/${sessionId}`),
    listSessions: (subjectId: string, page: { limit?: number; cursor?: string } = {}) => {
      const query = new URLSearchParams({ subjectId });
      if (page.limit) query.set("limit", String(page.limit));
      if (page.cursor) query.set("cursor", page.cursor);
      return request<BackendSessionPage>(`sessions?${query.toString()}`);
    },
    startSession: (sessionId: string) => post<BackendSession>(`sessions/${sessionId}/start`),
    startActivity: (sessionId: string, assignmentId: string) =>
      post<BackendSession>(`sessions/${sessionId}/activities/${assignmentId}/start`),
    ingestEvents: (sessionId: string, assignmentId: string, events: BackendCptEvent[]) =>
      post<EventBatchResponse>(`sessions/${sessionId}/activities/${assignmentId}/events:batch`, {
        events,
      }),
    completeActivity: (sessionId: string, assignmentId: string) =>
      post<BackendSession>(`sessions/${sessionId}/activities/${assignmentId}/complete`),
    getSessionSummaries: (sessionId: string) =>
      request<BackendActivitySummary[]>(`sessions/${sessionId}/summary`),

    getProgress: (subjectId: string) =>
      request<BackendProgress>(`subjects/${subjectId}/progress`),
    listActivitySummaries: (subjectId: string, page: { limit?: number; cursor?: string } = {}) => {
      const query = new URLSearchParams();
      if (page.limit) query.set("limit", String(page.limit));
      if (page.cursor) query.set("cursor", page.cursor);
      const suffix = query.size > 0 ? `?${query.toString()}` : "";
      return request<BackendActivitySummaryPage>(
        `subjects/${subjectId}/activity-summaries${suffix}`,
      );
    },
    getDigitalTwin: (subjectId: string) =>
      request<BackendDigitalTwin>(`subjects/${subjectId}/digital-twin`),
    listDigitalTwinHistory: (subjectId: string) =>
      request<{ items: BackendDigitalTwinHistoryItem[] }>(
        `subjects/${subjectId}/digital-twin/history`,
      ),

    listReports: (subjectId: string) =>
      request<{ items: BackendReport[] }>(`subjects/${subjectId}/reports`),
    createReport: (subjectId: string, body: ReportCreateRequest) =>
      post<BackendReport>(`subjects/${subjectId}/reports`, body),
  };
}

export type BackendClient = ReturnType<typeof createBackendClient>;
