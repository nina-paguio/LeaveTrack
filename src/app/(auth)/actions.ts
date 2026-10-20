"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate } from "@/lib/auth/authenticate";
import { clientIp } from "@/lib/auth/client-ip";
import { normalizeEmail } from "@/lib/auth/email";
import { REFUSED_MESSAGE, UNAVAILABLE_MESSAGE } from "@/lib/auth/messages";
import { clearAttempts, tooManyAttempts } from "@/lib/auth/rate-limit";
import { resolveUserRole } from "@/lib/auth/resolve-user";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { isUsableSecret } from "@/lib/auth/session-token";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { homeFor } from "@/lib/roles";
import { isPasswordSignInConfigured, verifyPassword } from "@/lib/supabase/auth";

export interface LoginState {
  error?: string;
}

const REFUSED: LoginState = { error: REFUSED_MESSAGE };
const UNAVAILABLE: LoginState = { error: UNAVAILABLE_MESSAGE };

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
  const ip = clientIp(h);
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

  await setSessionCookie(result.email, result.role, secret);
  logger.info("sign-in", { role: result.role });

  redirect(homeFor(result.role));
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(env.SESSION_COOKIE_NAME);
  redirect("/login");
}
