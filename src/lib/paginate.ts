export const PAGE_SIZE = 10;

export interface Page<T> {
  items: T[];
  /** 1-based, already clamped to a real page. */
  page: number;
  pageCount: number;
  total: number;
}

/**
 * Slices an already-scoped list into pages. It never decides which rows a user may see: callers pass
 * what the database query returned. A missing, non-numeric or out-of-range `?page=` falls back to the
 * nearest real page, so a bad URL never shows an empty page or an error.
 */
export function paginate<T>(items: T[], rawPage: unknown, size: number = PAGE_SIZE): Page<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const requested = typeof rawPage === "string" ? Number.parseInt(rawPage, 10) : NaN;
  const page = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), pageCount) : 1;
  return { items: items.slice((page - 1) * size, page * size), page, pageCount, total };
}
