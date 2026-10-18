import "server-only";
import { createLeaveRepo } from "@/lib/leave/repo";
import {
  getTeamRequest,
  getTeamRequests,
  type TeamRequest,
  type TeamRequestLookup,
} from "@/lib/leave/team";
import type { Session } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { leaveTypeById, requests, teamRequestsFor, userById } from "@/mocks/data";
import type { LeaveRequest } from "@/types/domain";

export interface TeamData {
  /** false when no database is configured and the rows below are mock data. */
  live: boolean;
  rows: TeamRequest[];
}

const withNames = (r: LeaveRequest): TeamRequest => ({
  ...r,
  employeeName: userById(r.userId)?.name ?? "Unknown",
  leaveTypeName: leaveTypeById(r.leaveTypeId)?.name ?? "Unknown",
});

/** For server pages: the manager's team queue, or mock data when Supabase is not configured. */
export async function loadTeam(session: Session): Promise<TeamData> {
  if (!isSupabaseConfigured()) {
    return { live: false, rows: teamRequestsFor(session.user.id).map(withNames) };
  }
  return { live: true, rows: await getTeamRequests(createLeaveRepo(), session.user.email) };
}

export async function loadTeamRequest(
  session: Session,
  id: string,
): Promise<{ live: boolean; lookup: TeamRequestLookup }> {
  if (!isSupabaseConfigured()) {
    const mine = teamRequestsFor(session.user.id).find((r) => r.id === id);
    if (mine) return { live: false, lookup: { kind: "found", request: withNames(mine) } };
    const exists = requests.some((r) => r.id === id && !r.isDeleted);
    return { live: false, lookup: { kind: exists ? "forbidden" : "missing" } };
  }
  return { live: true, lookup: await getTeamRequest(createLeaveRepo(), session.user.email, id) };
}
