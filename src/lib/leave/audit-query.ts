export interface AuditQuery {
  userId?: string;
  from?: string;
  to?: string;
}

/**
 * The audit report URL for a set of filters. The one place that builds it. Empty filters are left out.
 * The report is one page with every request, so there is no page number.
 */
export function auditHref({ userId, from, to }: AuditQuery): string {
  const q = new URLSearchParams();
  if (userId) q.set("userId", userId);
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const s = q.toString();
  return s ? `/audit?${s}` : "/audit";
}
