/**
 * The PKCE verifier for one Google sign-in. The start route keeps it in a short-lived httpOnly cookie
 * and the callback route reads it back, so only the browser that started the sign-in can finish it.
 * The value is the entry supabase-js stored (a storage key and its value), carried as base64url.
 */
export const OAUTH_COOKIE_NAME = "leavetrack-oauth";
export const OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export interface VerifierEntry {
  key: string;
  value: string;
}

const MAX_PART = 512;

export function serializeVerifier(entry: VerifierEntry): string {
  return Buffer.from(JSON.stringify(entry), "utf8").toString("base64url");
}

/** The entry, or null for anything missing, malformed or not shaped like a code-verifier entry. */
export function parseVerifier(raw: string | undefined): VerifierEntry | null {
  if (!raw || raw.length > 2 * MAX_PART + 64) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const { key, value } = parsed as Record<string, unknown>;
    if (
      typeof key !== "string" ||
      typeof value !== "string" ||
      !key.endsWith("-code-verifier") ||
      key.length > MAX_PART ||
      value.length === 0 ||
      value.length > MAX_PART
    ) {
      return null;
    }
    return { key, value };
  } catch {
    return null;
  }
}
