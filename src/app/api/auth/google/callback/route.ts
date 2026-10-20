import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateGoogle } from "@/lib/auth/authenticate";
import { clientIp } from "@/lib/auth/client-ip";
import { OAUTH_COOKIE_NAME, parseVerifier } from "@/lib/auth/oauth-verifier";
import { clearAttempts, tooManyAttempts } from "@/lib/auth/rate-limit";
import { resolveUserRole } from "@/lib/auth/resolve-user";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { isUsableSecret } from "@/lib/auth/session-token";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { homeFor } from "@/lib/roles";
import { exchangeGoogleCode, isGoogleSignInEnabled } from "@/lib/supabase/oauth";

/**
 * FINISHES GOOGLE SIGN-IN (ADR-LeaveTrack-E006). Google sends the person back here with a one-time
 * code. The code is traded (with the PKCE verifier from this browser's cookie) for a verified email;
 * the role then comes ONLY from the users table. Every refusal (no code, no cookie, unverified email,
 * wrong domain, not in users, throttled) goes to the same generic message. On success the app sets
 * its own signed cookie, exactly as password sign-in does. Neither the code nor the email is logged.
 */
export async function GET(request: Request): Promise<never> {
  const secret = env.SESSION_SECRET;
  if (!isUsableSecret(secret) || !isGoogleSignInEnabled()) {
    logger.error("google sign-in refused: not enabled or not configured");
    redirect("/login?error=unavailable");
  }

  const store = await cookies();
  const verifier = parseVerifier(store.get(OAUTH_COOKIE_NAME)?.value);
  store.delete({ name: OAUTH_COOKIE_NAME, path: "/api/auth/google" }); // one use only

  const ip = clientIp(await headers());
  if (tooManyAttempts(`ip:${ip}`)) {
    logger.warn("google sign-in throttled");
    redirect("/login?error=google");
  }

  const result = await authenticateGoogle(
    {
      exchangeCode: (code) =>
        verifier ? exchangeGoogleCode(code, verifier) : Promise.resolve(null),
      resolveRole: resolveUserRole,
    },
    new URL(request.url).searchParams.get("code"),
    verifier?.value,
    env.ALLOWED_EMAIL_DOMAIN,
  );
  if (!result.ok) {
    if (result.reason === "unavailable") {
      logger.error("google sign-in unavailable");
      redirect("/login?error=unavailable");
    }
    logger.warn("google sign-in refused");
    redirect("/login?error=google");
  }

  clearAttempts(`ip:${ip}`);
  await setSessionCookie(result.email, result.role, secret);
  logger.info("sign-in", { role: result.role, method: "google" });
  redirect(homeFor(result.role));
}
