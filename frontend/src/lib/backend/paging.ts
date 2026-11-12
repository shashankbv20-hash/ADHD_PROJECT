/**
 * Cursor paging helpers. The API returns at most 100 items per page with an opaque
 * `nextCursor`; these helpers follow the cursor until the list is complete, with a hard
 * page cap so a misbehaving server can never cause an endless loop.
 */
export const PAGE_SIZE = 100;
export const MAX_PAGES = 50;

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AllPages<T> {
  items: T[];
  /** True when the page cap was reached and more items exist on the server. */
  truncated: boolean;
  pages: number;
}

export async function fetchAllPages<T>(
  fetchPage: (cursor: string | undefined) => Promise<PageResult<T>>,
  {
    maxPages = MAX_PAGES,
    onProgress,
  }: { maxPages?: number; onProgress?: (loaded: number, pages: number) => void } = {},
): Promise<AllPages<T>> {
  const items: T[] = [];
  let cursor: string | undefined;
  let pages = 0;

  while (pages < maxPages) {
    const page = await fetchPage(cursor);
    pages += 1;
    items.push(...page.items);
    onProgress?.(items.length, pages);
    if (!page.nextCursor || page.nextCursor === cursor) {
      return { items, truncated: false, pages };
    }
    cursor = page.nextCursor;
  }

  return { items, truncated: true, pages };
}
