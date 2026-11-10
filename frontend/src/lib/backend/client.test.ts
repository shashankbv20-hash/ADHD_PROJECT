import { describe, expect, it, vi } from "vitest";

import { ApiClientError, ApiError } from "@/lib/api-client";
import { AuthTokenUnavailableError, createBackendClient } from "@/lib/backend/client";

const BASE = "https://api.example.test";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup(
  fetcher: typeof fetch,
  getIdToken: (forceRefresh: boolean) => Promise<string> = async () => "token-1",
) {
  return { getIdToken, client: createBackendClient({ baseUrl: BASE, getIdToken, fetcher }) };
}

function lastRequest(fetcher: ReturnType<typeof vi.fn>, call = 0) {
  const [url, init] = fetcher.mock.calls[call] as unknown as [URL, RequestInit];
  return { url: url.toString(), init, headers: new Headers(init.headers) };
}

describe("createBackendClient", () => {
  it("sends the Firebase ID token as a bearer token and targets /api/v1", async () => {
    const fetcher = vi.fn(async () => json({ items: [] }));
    const getIdToken = vi.fn<(forceRefresh: boolean) => Promise<string>>(async () => "token-1");
    const { client } = setup(fetcher as unknown as typeof fetch, getIdToken);

    await client.listSubjects();

    const request = lastRequest(fetcher);
    expect(request.url).toBe(`${BASE}/api/v1/subjects`);
    expect(request.headers.get("Authorization")).toBe("Bearer token-1");
    expect(getIdToken).toHaveBeenCalledWith(false);
  });

  it("retries once with a force-refreshed token after a 401", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { code: "invalid_bearer_token" } }, 401))
      .mockResolvedValueOnce(json({ items: [] }));
    const getIdToken = vi.fn(async (force: boolean) => (force ? "fresh-token" : "stale-token"));
    const { client } = setup(fetcher as unknown as typeof fetch, getIdToken);

    await expect(client.listSubjects()).resolves.toEqual({ items: [] });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(lastRequest(fetcher, 0).headers.get("Authorization")).toBe("Bearer stale-token");
    expect(lastRequest(fetcher, 1).headers.get("Authorization")).toBe("Bearer fresh-token");
    expect(getIdToken.mock.calls.map(([force]) => force)).toEqual([false, true]);
  });

  it("does not loop on repeated 401s", async () => {
    const fetcher = vi.fn(async () => json({ error: { code: "invalid_bearer_token" } }, 401));
    const { client } = setup(fetcher as unknown as typeof fetch);

    await expect(client.getMe()).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not retry other failures", async () => {
    const fetcher = vi.fn(async () => json({ error: { code: "forbidden" } }, 403));
    const { client } = setup(fetcher as unknown as typeof fetch);

    await expect(client.getMe()).rejects.toMatchObject({ status: 403 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("exposes only the backend error code and request ID, never the message", async () => {
    const fetcher = vi.fn(async () =>
      json(
        { error: { code: "consent_required", message: "SECRET server text", requestId: "req-123" } },
        403,
      ),
    );
    const { client } = setup(fetcher as unknown as typeof fetch);

    const error = (await client.createSession({
      subjectId: "s",
      activities: [{ activityCode: "cpt", mode: "scored" }],
      idempotencyKey: "cpt-run-abcdefgh",
    }).catch((caught: unknown) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.backendCode).toBe("consent_required");
    expect(error.requestId).toBe("req-123");
    expect(error.message).not.toContain("SECRET");
  });

  it("ignores malformed error envelopes", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response("<html>bad gateway</html>", {
          status: 502,
          headers: { "content-type": "text/html" },
        }),
    );
    const { client } = setup(fetcher as unknown as typeof fetch);

    const error = (await client.getMe().catch((caught: unknown) => caught)) as ApiError;
    expect(error.status).toBe(502);
    expect(error.backendCode).toBeUndefined();
    expect(error.requestId).toBeUndefined();
  });

  it("rejects error codes with unexpected characters", async () => {
    const fetcher = vi.fn(async () =>
      json({ error: { code: "<script>alert(1)</script>", requestId: "bad id!" } }, 400),
    );
    const { client } = setup(fetcher as unknown as typeof fetch);

    const error = (await client.getMe().catch((caught: unknown) => caught)) as ApiError;
    expect(error.backendCode).toBeUndefined();
    expect(error.requestId).toBeUndefined();
  });

  it("reports a missing sign-in without calling the network", async () => {
    const fetcher = vi.fn();
    const getIdToken = vi.fn(async () => {
      throw new AuthTokenUnavailableError();
    });
    const { client } = setup(fetcher as unknown as typeof fetch, getIdToken);

    const error = (await client.getMe().catch((caught: unknown) => caught)) as ApiClientError;
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error.kind).toBe("configuration");
    expect(error.code).toBe("auth-token-unavailable");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("builds endpoint paths and bodies", async () => {
    const fetcher = vi.fn(async () => json({}));
    const { client } = setup(fetcher as unknown as typeof fetch);

    await client.ingestEvents("sess", "assign", [
      {
        trialIndex: 0,
        trialId: "cpt-scored-01",
        stimulus: "A",
        isTarget: false,
        responded: false,
        reactionTimeMs: null,
      },
    ]);
    await client.listActivitySummaries("subj", { limit: 5, cursor: "abc" });
    await client.withdrawConsent("subj", "consent-1");

    expect(lastRequest(fetcher, 0).url).toBe(
      `${BASE}/api/v1/sessions/sess/activities/assign/events:batch`,
    );
    expect(lastRequest(fetcher, 0).init.method).toBe("POST");
    expect(JSON.parse(lastRequest(fetcher, 0).init.body as string).events).toHaveLength(1);
    expect(lastRequest(fetcher, 1).url).toBe(
      `${BASE}/api/v1/subjects/subj/activity-summaries?limit=5&cursor=abc`,
    );
    expect(lastRequest(fetcher, 2).url).toBe(
      `${BASE}/api/v1/subjects/subj/consents/consent-1/withdraw`,
    );
  });
});
