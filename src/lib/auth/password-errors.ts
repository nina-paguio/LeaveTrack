/** What a failed Supabase password check means for the sign-in form. */
export type PasswordFailure = "refused" | "unavailable";

/**
 * "refused": the credentials are wrong or the account cannot sign in (unknown email, wrong password,
 * unconfirmed, throttled). All of these look the same to the visitor.
 * "unavailable": Supabase could not be reached or failed (network error, 5xx), so the visitor is told
 * to try again instead of being told their password is wrong.
 */
export function classifyPasswordError(error: {
  status?: number | null;
  code?: string | null;
}): PasswordFailure {
  const status = error.status ?? 0;
  if (status === 0 || status >= 500) return "unavailable";
  return "refused";
}
