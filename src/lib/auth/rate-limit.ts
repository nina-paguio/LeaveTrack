// Best-effort, per server instance. On serverless each instance has its own memory, so this slows
// guessing down but is not a hard limit. Vercel Deployment Protection / WAF is the real perimeter.
const attempts = new Map<string, number[]>();

export const MAX_ATTEMPTS = 8;
export const WINDOW_MS = 10 * 60 * 1000;

export function tooManyAttempts(key: string, now = Date.now()): boolean {
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(key, recent);
    return true;
  }
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 5000) attempts.clear();
  return false;
}

/** A successful sign-in clears its keys, so only failed attempts count toward the limit. */
export function clearAttempts(key: string): void {
  attempts.delete(key);
}

export function resetAttempts(): void {
  attempts.clear();
}
