import { describe, expect, it, vi } from "vitest";

import { ApiClientError, ApiError, createApiClient } from "@/lib/api-client";

const BASE = "https://api.example.test/api/v1";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

async function failure(promise: Promise<unknown>): Promise<ApiClientError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiClientError);
    return error as ApiClientError;
  }
  throw new Error("Expected the request to fail.");
}

describe("createApiClient.requestJson", () => {
  it("GETs JSON with an Accept header and no cache", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ ok: true }));
    const client = createApiClient({ baseUrl: BASE, fetcher });

    await expect(client.requestJson("/capabilities")).resolves.toEqual({ ok: true });

    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toBe(`${BASE}/capabilities`);
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
    expect(new Headers(init.headers).get("Accept")).toBe("application/json");
  });

  it("serializes bodies as JSON and defaults the method to POST", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ id: 1 }));
    const client = createApiClient({ baseUrl: BASE, fetcher });

    await client.requestJson("sessions", { body: { subjectId: "s-1" } });

    const [, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"subjectId":"s-1"}');
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
  });

  it("returns undefined for 204 responses", async () => {
    const client = createApiClient({
      baseUrl: BASE,
      fetcher: async () => new Response(null, { status: 204 }),
    });
    await expect(client.requestJson("x", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("refuses GET requests with a body", async () => {
    const client = createApiClient({ baseUrl: BASE, fetcher: vi.fn() });
    const error = await failure(client.requestJson("x", { method: "GET", body: {} }));
    expect(error.code).toBe("get-request-with-body");
  });

  it("rejects paths that escape the configured origin", async () => {
    const fetcher = vi.fn();
    const client = createApiClient({ baseUrl: BASE, fetcher });
    const error = await failure(client.requestJson("https://evil.test/steal"));
    expect(error.code).toBe("cross-origin-request-path");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports an unserializable body", async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const client = createApiClient({ baseUrl: BASE, fetcher: vi.fn() });
    const error = await failure(client.requestJson("x", { body: circular }));
    expect(error.code).toBe("json-serialization-failed");
  });

  it("reports not-configured when no base URL exists, without calling fetch", async () => {
    const fetcher = vi.fn();
    const client = createApiClient({ baseUrl: null, fetcher });
    const error = await failure(client.requestJson("x"));
    expect(error.kind).toBe("not-configured");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("surfaces a configuration error before anything else", async () => {
    const client = createApiClient({ baseUrl: BASE, fetcher: vi.fn(), configurationError: "bad config" });
    const error = await failure(client.requestJson("x"));
    expect(error.kind).toBe("configuration");
    expect(error.message).toBe("bad config");
  });

  it("maps HTTP failures to ApiError without leaking the body", async () => {
    const client = createApiClient({
      baseUrl: BASE,
      fetcher: async () => jsonResponse({ error: { message: "secret detail" } }, { status: 403 }),
    });
    const error = await failure(client.requestJson("x"));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(403);
    expect(error.message).not.toContain("secret detail");
  });

  it("maps network failures", async () => {
    const client = createApiClient({
      baseUrl: BASE,
      fetcher: async () => {
        throw new TypeError("fetch failed");
      },
    });
    expect((await failure(client.requestJson("x"))).kind).toBe("network");
  });

  it("maps aborts to a cancelled error", async () => {
    const controller = new AbortController();
    const client = createApiClient({
      baseUrl: BASE,
      fetcher: async () => {
        controller.abort();
        throw new DOMException("aborted", "AbortError");
      },
    });
    expect((await failure(client.requestJson("x", { signal: controller.signal }))).kind).toBe("cancelled");
  });

  it("rejects successful non-JSON responses", async () => {
    const client = createApiClient({
      baseUrl: BASE,
      fetcher: async () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }),
    });
    expect((await failure(client.requestJson("x"))).code).toBe("unexpected-content-type");
  });

  it("rejects malformed JSON bodies", async () => {
    const client = createApiClient({
      baseUrl: BASE,
      fetcher: async () =>
        new Response("{not json", { status: 200, headers: { "content-type": "application/json" } }),
    });
    expect((await failure(client.requestJson("x"))).code).toBe("invalid-json-response");
  });

  it("accepts +json content types", async () => {
    const client = createApiClient({
      baseUrl: BASE,
      fetcher: async () =>
        new Response('{"a":1}', { status: 200, headers: { "content-type": "application/problem+json" } }),
    });
    await expect(client.requestJson("x")).resolves.toEqual({ a: 1 });
  });
});
