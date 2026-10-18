"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate } from "@/lib/auth/authenticate";
import { normalizeEmail } from "@/lib/auth/email";
import { clearAttempts, tooManyAttempts } from "@/lib/auth/rate-limit";
import { resolveUserRole } from "@/lib/auth/resolve-user";
import { createSessionToken, isUsableSecret } from "@/lib/auth/session-token";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { homeFor } from "@/lib/roles";
import { isPasswordSignInConfigured, verifyPassword } from "@/lib/supabase/auth";

export interface LoginState {
  error?: string;
}

// One message for every refusal (wrong password, unknown person, not in users, throttled) so the form
// never reveals which company emails exist.
const REFUSED: LoginState = { error: "We couldn't sign you in with those details." };
const UNAVAILABLE: LoginState = { error: "Sign-in is not available right now. Try again soon." };

/**
 * EMAIL + PASSWORD SIGN-IN (ADR-LeaveTrack-E003). Supabase Auth checks the password (it stores only a
 * salted hash). The role comes from the users table, never from the form or from Supabase. On success
 * the app sets its OWN signed cookie (httpOnly, SameSite=Lax, Secure in production, 8h); the cookie
 * cannot be edited without SESSION_SECRET. There is no sign-up: accounts are created by an admin.
 * The password is never logged.
 */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const secret = env.SESSION_SECRET;
  if (!isUsableSecret(secret) || !isPasswordSignInConfigured()) {
    logger.error(
      "sign-in refused: SESSION_SECRET (32+ chars), NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set",
    );
    return UNAVAILABLE;
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const email = normalizeEmail(formData.get("email"));
  // Best effort on serverless (per instance); Supabase applies its own limits as well.
  if (tooManyAttempts(`ip:${ip}`) || tooManyAttempts(`email:${email}`)) {
    logger.warn("sign-in throttled");
    return REFUSED;
  }

  const result = await authenticate(
    { verifyPassword, resolveRole: resolveUserRole },
    email,
    formData.get("password"),
    env.ALLOWED_EMAIL_DOMAIN,
  );
  if (!result.ok) {
    if (result.reason === "unavailable") {
      logger.error("sign-in unavailable");
      return UNAVAILABLE;
    }
    logger.warn("sign-in refused");
    return REFUSED;
  }

  clearAttempts(`ip:${ip}`);
  clearAttempts(`email:${email}`);

  const store = await cookies();
  store.set(
    env.SESSION_COOKIE_NAME,
    createSessionToken(
      { email: result.email, role: result.role },
      secret,
      env.SESSION_MAX_AGE_SECONDS,
    ),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: env.SESSION_MAX_AGE_SECONDS,
    },
  );
  logger.info("sign-in", { role: result.role });

  redirect(homeFor(result.role));
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(env.SESSION_COOKIE_NAME);
  redirect("/login");
}
