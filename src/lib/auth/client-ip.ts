/** The caller's address as the platform reports it; "unknown" when it does not. Used only to throttle. */
export function clientIp(h: Pick<Headers, "get">): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
