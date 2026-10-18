import "server-only";
import { createLeaveRepo } from "@/lib/leave/repo";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { Role } from "@/types/domain";

/**
 * The only place a role is decided at sign-in: from the users table, never from the form or from the
 * identity provider. Unknown email returns null. With no database configured it throws, so sign-in
 * fails closed instead of falling back to mock users.
 */
export async function resolveUserRole(email: string): Promise<Role | null> {
  if (!isSupabaseConfigured()) throw new Error("Database is not configured.");
  const found = await createLeaveRepo().findUserByEmail(email);
  return found?.role ?? null;
}
