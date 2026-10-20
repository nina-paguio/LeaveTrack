import { cookies } from "next/headers";
import { createSessionToken } from "@/lib/auth/session-token";
import { env } from "@/lib/env";
import type { Role } from "@/types/domain";

/**
 * Sets the app's OWN signed session cookie (httpOnly, SameSite=Lax, Secure in production, 8h). The one
 * place it is set, shared by the password and Google sign-in, so the two can never drift apart.
 * The caller has already decided the sign-in succeeded and checked that `secret` is usable.
 */
export async function setSessionCookie(email: string, role: Role, secret: string): Promise<void> {
  const store = await cookies();
  store.set(
    env.SESSION_COOKIE_NAME,
    createSessionToken({ email, role }, secret, env.SESSION_MAX_AGE_SECONDS),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: env.SESSION_MAX_AGE_SECONDS,
    },
  );
}
