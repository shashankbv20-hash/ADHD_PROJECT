import { describe, expect, it, vi } from "vitest";
import { fetchAllPages } from "./paging";

describe("fetchAllPages", () => {
  it("follows cursors until the last page", async () => {
    const fetchPage = vi.fn(async (cursor?: string) =>
      cursor === undefined
        ? { items: [1, 2], nextCursor: "a" }
        : cursor === "a"
          ? { items: [3], nextCursor: "b" }
          : { items: [4], nextCursor: null },
    );
    const progress = vi.fn();

    const result = await fetchAllPages(fetchPage, { onProgress: progress });

    expect(result).toEqual({ items: [1, 2, 3, 4], truncated: false, pages: 3 });
    expect(fetchPage.mock.calls.map(([cursor]) => cursor)).toEqual([undefined, "a", "b"]);
    expect(progress).toHaveBeenLastCalledWith(4, 3);
  });

  it("stops at the page cap and reports truncation", async () => {
    let n = 0;
    const result = await fetchAllPages(async () => ({ items: [n++], nextCursor: `c${n}` }), {
      maxPages: 3,
    });
    expect(result).toEqual({ items: [0, 1, 2], truncated: true, pages: 3 });
  });

  it("does not loop when the server repeats a cursor", async () => {
    const fetchPage = vi.fn(async () => ({ items: [1], nextCursor: "same" }));
    const result = await fetchAllPages(fetchPage);
    expect(result.pages).toBe(2);
    expect(result.truncated).toBe(false);
  });

  it("propagates errors", async () => {
    await expect(fetchAllPages(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
  });
});
