import "server-only";
import { getMyLeave, type MyLeave } from "@/lib/leave/mine";
import { createLeaveRepo } from "@/lib/leave/repo";
import type { Session } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { balancesFor, requestsFor } from "@/mocks/data";

export interface MyLeaveData extends MyLeave {
  /** false when no database is configured and the data below is mock data. */
  live: boolean;
}

/**
 * For server pages. Reads the real database through the service; with no Supabase credentials
 * it falls back to mock data so the app still runs on a fresh clone.
 */
export async function loadMyLeave(session: Session): Promise<MyLeaveData> {
  if (!isSupabaseConfigured()) {
    return {
      live: false,
      requests: requestsFor(session.user.id),
      balances: balancesFor(session.user.id),
    };
  }
  return { live: true, ...(await getMyLeave(createLeaveRepo(), session.user.email)) };
}
