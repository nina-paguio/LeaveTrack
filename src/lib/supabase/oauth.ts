import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VerifierEntry } from "@/lib/auth/oauth-verifier";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/** Google sign-in is offered only when it is switched on and Supabase is configured. */
export function isGoogleSignInEnabled(): boolean {
  return (
    env.GOOGLE_SIGN_IN_ENABLED === "true" &&
    Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  );
}

const FLOW_SLOT = /-flow-([0-9a-zA-Z_-]+)-code-verifier$/;

/** A throwaway in-memory store: supabase-js keeps its PKCE verifier here, and we carry it ourselves. */
function memoryStorage(seed?: VerifierEntry) {
  const map = new Map<string, string>(seed ? [[seed.key, seed.value]] : []);
  return {
    map,
    storage: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key),
    },
  };
}

function client(seed?: VerifierEntry) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase sign-in is not configured.");
  const store = memoryStorage(seed);
  const supabase: SupabaseClient = createClient(url, key, {
    auth: {
      flowType: "pkce",
      storage: store.storage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return { supabase, store };
}

/**
 * Step 1: asks Supabase for the Google sign-in address and returns it with the PKCE verifier this
 * browser must present when it comes back. Uses the PUBLISHABLE key. Nothing is stored here.
 */
export async function startGoogleSignIn(
  redirectTo: string,
): Promise<{ url: string; verifier: VerifierEntry }> {
  const { supabase, store } = client();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    logger.error("google sign-in could not start", { status: error?.status ?? 0 });
    throw new Error("Could not start Google sign-in.");
  }
  // supabase-js keeps the verifier in a slot named for this flow (and mirrors it to a fixed legacy key).
  // Carry the flow's own slot, so the exchange can name the flow it belongs to.
  const entries = [...store.map.entries()];
  const entry = entries.find(([k]) => FLOW_SLOT.test(k)) ?? entries.find(([k]) => k.endsWith("-code-verifier"));
  if (!entry) throw new Error("Could not start Google sign-in.");
  return { url: data.url, verifier: { key: entry[0], value: entry[1] } };
}

/**
 * Step 2: trades the one-time code for the Google account's email and whether Google verified it, then
 * revokes the Supabase session at once (the app issues its own signed cookie, ADR-LeaveTrack-E003).
 * The email comes from the Google identity record, which a user cannot edit, never from user metadata.
 *
 * Resolves null when the code is not accepted. Rejects when Supabase cannot be reached.
 */
export async function exchangeGoogleCode(
  code: string,
  verifier: VerifierEntry,
): Promise<{ email: string; emailVerified: boolean } | null> {
  const { supabase } = client(verifier);
  // Name the flow when the stored slot is one, so supabase-js reads exactly that verifier.
  const flowId = FLOW_SLOT.exec(verifier.key)?.[1];
  const { data, error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );
  if (error) {
    // 5xx or no status at all means Supabase is down; a 4xx means the code was not accepted.
    if (!error.status || error.status >= 500) {
      logger.error("google code exchange unavailable", { status: error.status ?? 0 });
      throw new Error("Supabase Auth is unavailable.");
    }
    return null;
  }

  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

  const google = data.user?.identities?.find((i) => i.provider === "google");
  const identity = google?.identity_data as { email?: unknown; email_verified?: unknown } | undefined;
  if (typeof identity?.email !== "string") return null;
  return { email: identity.email, emailVerified: identity.email_verified === true };
}
