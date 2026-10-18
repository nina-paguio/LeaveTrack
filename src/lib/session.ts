import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth/session-token";
import { env } from "@/lib/env";
import { users } from "@/mocks/data";
import type { Role, User } from "@/types/domain";

export interface Session {
  role: Role;
  user: User;
}

/**
 * Reads the signed session cookie set by loginAction. The role and email come from the signed
 * payload (so they cannot be edited); routes still re-check the database role.
 * `user` is the matching mock profile for display, or a bare profile when there is none.
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const claims = verifySessionToken(store.get(env.SESSION_COOKIE_NAME)?.value, env.SESSION_SECRET);
  if (!claims) return null;
  const user = users.find((u) => u.email.toLowerCase() === claims.email) ?? {
    id: claims.email,
    name: claims.email,
    email: claims.email,
    role: claims.role,
    managerId: null,
  };
  return { role: claims.role, user };
}
