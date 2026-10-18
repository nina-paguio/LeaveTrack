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
