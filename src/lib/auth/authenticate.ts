import { isCompanyEmail, isPlausibleEmail, normalizeEmail } from "@/lib/auth/email";
import type { Role } from "@/types/domain";

export interface AuthDeps {
  /**
   * Checks the password with the identity provider. Resolves the verified email, or null when the
   * credentials are wrong. Rejects when the provider is unreachable.
   */
  verifyPassword(email: string, password: string): Promise<string | null>;
  /** The role stored in the users table for this email, or null if the person is not in it. */
  resolveRole(email: string): Promise<Role | null>;
}

export type AuthResult =
  { ok: true; email: string; role: Role } | { ok: false; reason: "refused" | "unavailable" };

export const MAX_PASSWORD_LENGTH = 128;

/**
 * Sign-in decision, with no I/O of its own so it can be tested without a network.
 *
 * - The password is checked BEFORE the users table, so an unknown email and a wrong password take the
 *   same path and return the same "refused": the form never reveals which emails exist.
 * - The role comes ONLY from the users table. Anything the identity provider says about the user
 *   (metadata, claims) is ignored, because users can edit their own metadata.
 * - A password is never returned, logged or stored here.
 */
export async function authenticate(
  deps: AuthDeps,
  rawEmail: unknown,
  rawPassword: unknown,
  allowedDomain?: string,
): Promise<AuthResult> {
  const email = normalizeEmail(rawEmail);
  const password = typeof rawPassword === "string" ? rawPassword : "";
  if (
    !isPlausibleEmail(email) ||
    password.length === 0 ||
    password.length > MAX_PASSWORD_LENGTH ||
    (allowedDomain && !isCompanyEmail(email, allowedDomain))
  ) {
    return { ok: false, reason: "refused" };
  }

  let verified: string | null;
  try {
    verified = await deps.verifyPassword(email, password);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!verified) return { ok: false, reason: "refused" };

  let role: Role | null;
  try {
    role = await deps.resolveRole(verified);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!role) return { ok: false, reason: "refused" };

  return { ok: true, email: verified, role };
}

export interface GoogleAuthDeps {
  /**
   * Trades the one-time code from the redirect (plus this browser's PKCE verifier) for the Google
   * account's email and whether Google has verified it. Resolves null when the code is not accepted.
   * Rejects when the provider is unreachable.
   */
  exchangeCode(
    code: string,
    verifier: string,
  ): Promise<{ email: string; emailVerified: boolean } | null>;
  /** The role stored in the users table for this email, or null if the person is not in it. */
  resolveRole(email: string): Promise<Role | null>;
}

/**
 * Google sign-in decision, with no I/O of its own (same rules as `authenticate`).
 *
 * - Only an email Google reports as verified counts: an unverified address proves nothing.
 * - The company domain (when one is set) and the users table both still apply. Having a Google account
 *   is never enough: a person with no users row is refused with the same answer as everything else.
 * - The role comes ONLY from the users table, never from anything Google or Supabase say about the user.
 */
export async function authenticateGoogle(
  deps: GoogleAuthDeps,
  code: unknown,
  verifier: unknown,
  allowedDomain?: string,
): Promise<AuthResult> {
  if (typeof code !== "string" || !code || typeof verifier !== "string" || !verifier) {
    return { ok: false, reason: "refused" };
  }

  let identity: { email: string; emailVerified: boolean } | null;
  try {
    identity = await deps.exchangeCode(code, verifier);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!identity || identity.emailVerified !== true) return { ok: false, reason: "refused" };

  const email = normalizeEmail(identity.email);
  if (!isPlausibleEmail(email) || (allowedDomain && !isCompanyEmail(email, allowedDomain))) {
    return { ok: false, reason: "refused" };
  }

  let role: Role | null;
  try {
    role = await deps.resolveRole(email);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!role) return { ok: false, reason: "refused" };

  return { ok: true, email, role };
}
