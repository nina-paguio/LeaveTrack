import "server-only";
import { createClient } from "@supabase/supabase-js";
import { classifyPasswordError } from "@/lib/auth/password-errors";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export function isPasswordSignInConfigured(): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

/**
 * Checks an email + password with Supabase Auth. Supabase stores only a salted hash (bcrypt) in
 * auth.users; this app never stores, logs or returns the password.
 *
 * Resolves the verified, lower-cased email, or null when the credentials are wrong. Rejects when
 * Supabase cannot be reached, so the form can say "try again" instead of "wrong password".
 *
 * Uses the PUBLISHABLE key (the public sign-in flow), never the secret key, and keeps no session:
 * the app issues its own signed cookie (ADR-LeaveTrack-E003), so the Supabase session this call
 * creates is revoked straight away. There is no sign-up here: accounts are created by an admin.
 */
export async function verifyPassword(email: string, password: string): Promise<string | null> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase sign-in is not configured.");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (classifyPasswordError(error) === "unavailable") {
      logger.error("password check unavailable", { status: error.status ?? 0 });
      throw new Error("Supabase Auth is unavailable.");
    }
    return null;
  }

  // Revoke the session just created; we only needed the yes/no. Best effort.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

  return data.user?.email ? data.user.email.trim().toLowerCase() : null;
}
