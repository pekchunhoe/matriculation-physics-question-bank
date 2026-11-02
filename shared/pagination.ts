export const questionPageSize = 10;
export type PageInfo = { total: number; page: number; pages: number; pageSize: number };
export type QuestionPage<T> = PageInfo & { items: T[] };

/** Invalid API values are rejected; UI callers may fall back to the first page. */
export function parseQuestionPage(value: unknown): number | undefined {
  if (value === undefined) return 1;
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value)))
    return undefined;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= 100000 ? page : undefined;
}

export function questionPagination(
  total: number,
  requested = 1,
  pageSize = questionPageSize,
): PageInfo {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return { total, page: Math.min(Math.max(1, requested), pages), pages, pageSize };
}

/** At most seven tokens, including first/last pages and gaps. */
export function questionPageNumbers(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, 'gap', pages];
  if (page >= pages - 3) return [1, 'gap', pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, 'gap', page - 1, page, page + 1, 'gap', pages];
}
