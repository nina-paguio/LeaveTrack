/**
 * Inclusive calendar days between two YYYY-MM-DD dates (weekends included).
 * The PRD/BRD state no working-day rule, so this is the single shared definition:
 * the form's hint and the server's warning must agree.
 */
export function inclusiveDays(start: string, end: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((toUtc(end) - toUtc(start)) / 86_400_000) + 1;
}
