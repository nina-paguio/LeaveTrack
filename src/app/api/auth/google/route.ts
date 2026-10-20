import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  OAUTH_COOKIE_MAX_AGE_SECONDS,
  OAUTH_COOKIE_NAME,
  serializeVerifier,
} from "@/lib/auth/oauth-verifier";
import { isUsableSecret } from "@/lib/auth/session-token";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { isGoogleSignInEnabled, startGoogleSignIn } from "@/lib/supabase/oauth";

/**
 * STARTS GOOGLE SIGN-IN (ADR-LeaveTrack-E006). Sends the browser to Google through Supabase (PKCE) and
 * keeps the verifier in a short-lived httpOnly cookie, so only this browser can finish the sign-in.
 * Takes no parameters: where the person lands afterwards is decided by their role, never by the URL.
 * No session is needed (it is a public path in proxy.ts); it fails closed when switched off or unconfigured.
 */
export async function GET(request: Request): Promise<never> {
  if (!isUsableSecret(env.SESSION_SECRET) || !isGoogleSignInEnabled()) {
    logger.error("google sign-in refused: not enabled or not configured");
    redirect("/login?error=unavailable");
  }

  let target: string;
  let verifier: string;
  try {
    const started = await startGoogleSignIn(new URL("/api/auth/google/callback", request.url).href);
    target = started.url;
    verifier = serializeVerifier(started.verifier);
  } catch {
    redirect("/login?error=unavailable");
  }

  const store = await cookies();
  store.set(OAUTH_COOKIE_NAME, verifier, {
    httpOnly: true,
    sameSite: "lax", // sent when Google sends the person back to us
    secure: env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  });
  redirect(target);
}
