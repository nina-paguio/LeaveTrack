import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { isRole } from "@/lib/roles";
import { MOCK_USER_BY_ROLE, userById } from "@/mocks/data";
import type { Role, User } from "@/types/domain";

export interface Session {
  role: Role;
  user: User;
}

/**
 * Mock session (ADR-LeaveTrack-E001): the cookie only holds a role.
 * Day 1 changes how the cookie is set, not how it is read.
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const role = store.get(env.SESSION_COOKIE_NAME)?.value;
  if (!isRole(role)) return null;
  const user = userById(MOCK_USER_BY_ROLE[role]);
  return user ? { role, user } : null;
}
