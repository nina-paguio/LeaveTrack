const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** "2026-10-17" -> "Oct 17, 2026". Plain calendar math, so the label never shifts with a time zone. */
export function formatDate(iso: string): string {
  const p = parts(iso);
  return p ? `${MONTHS[p.m - 1] ?? "?"} ${p.d}, ${p.y}` : iso;
}

/**
 * Compact leave dates for lists: "Oct 17, 2026" (one day), "Oct 17–18, 2026", "Oct 30 – Nov 2, 2026"
 * or "Dec 30, 2026 – Jan 2, 2027". Unparseable input is returned as given.
 */
export function formatDateRange(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  if (!a || !b) return `${start} to ${end}`;
  if (start === end) return formatDate(start);
  if (a.y !== b.y) return `${formatDate(start)} – ${formatDate(end)}`;
  const am = MONTHS[a.m - 1] ?? "?";
  const bm = MONTHS[b.m - 1] ?? "?";
  if (a.m !== b.m) return `${am} ${a.d} – ${bm} ${b.d}, ${b.y}`;
  return `${am} ${a.d}–${b.d}, ${b.y}`;
}

/** A timestamp for people in the Philippines (the app's accrual clock is Asia/Manila): "Sep 14, 2026, 5:30 PM". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "2026-10-01" -> "October 2026" (UTC, so the label never shifts with the viewer's time zone). */
export function formatMonth(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
