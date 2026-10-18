export interface AuditQuery {
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
}

/**
 * The audit report URL for a set of filters. The one place that builds it, so the filter form and the
 * pager always agree. Empty filters are left out; page 1 is the default and is left out too.
 */
export function auditHref({ userId, from, to, page }: AuditQuery): string {
  const q = new URLSearchParams();
  if (userId) q.set("userId", userId);
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  if (page && page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/audit?${s}` : "/audit";
}
