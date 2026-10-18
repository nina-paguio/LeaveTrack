import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { RepoLeaveType, RepoUser } from "@/lib/leave/submit";
import type { LeaveRequest } from "@/types/domain";

/** A request as returned by the team query: the request plus its owner's display name. */
export interface RepoTeamRequest extends LeaveRequest {
  employeeName: string;
}

export interface TeamRequest extends RepoTeamRequest {
  leaveTypeName: string;
}

/**
 * Read access for the manager queue (US-04). `listTeamRequests` MUST apply the manager scope in the
 * query itself (see team_leave_requests in migration 0003); this layer never filters by team.
 */
export interface TeamRepo {
  findUserByEmail(email: string): Promise<RepoUser | null>;
  listLeaveTypes(): Promise<RepoLeaveType[]>;
  listTeamRequests(managerId: string): Promise<RepoTeamRequest[]>;
  /** True if a non-deleted request with this id exists (used only to tell 403 from 404). */
  requestExists(id: string): Promise<boolean>;
}

export type TeamRequestLookup =
  { kind: "found"; request: TeamRequest } | { kind: "forbidden" } | { kind: "missing" };

/** The database role is the authority: a session that says "manager" is not enough. */
export async function requireManager(
  repo: Pick<TeamRepo, "findUserByEmail">,
  email: string,
): Promise<RepoUser> {
  const user = await repo.findUserByEmail(email);
  if (!user) throw new AppError("NOT_FOUND", "Your user profile was not found.", 404);
  if (user.role !== "manager") {
    throw new AppError("FORBIDDEN", "You do not have access to this resource.", 403);
  }
  return user;
}

/** Pending first (they need action), then newest first. */
const byQueueOrder = (a: TeamRequest, b: TeamRequest) =>
  Number(b.status === "pending") - Number(a.status === "pending") ||
  b.createdAt.localeCompare(a.createdAt);

export async function getTeamRequests(repo: TeamRepo, email: string): Promise<TeamRequest[]> {
  const manager = await requireManager(repo, email);
  const [rows, types] = await Promise.all([
    repo.listTeamRequests(manager.id),
    repo.listLeaveTypes(),
  ]);

  return rows
    .filter((r) => !r.isDeleted) // second layer behind the SQL filter
    .map((r) => ({
      ...r,
      leaveTypeName: types.find((t) => t.id === r.leaveTypeId)?.name ?? "Unknown",
    }))
    .sort(byQueueOrder);
}

/**
 * US-03 AC3: a request that exists but is not a direct report's is forbidden, never shown.
 * A request that does not exist at all is missing.
 */
export async function getTeamRequest(
  repo: TeamRepo,
  email: string,
  requestId: string,
): Promise<TeamRequestLookup> {
  // Enforces the manager check and the team scope before anything else.
  const request = (await getTeamRequests(repo, email)).find((r) => r.id === requestId);
  if (request) return { kind: "found", request };
  // A malformed id cannot exist; asking Postgres about it would raise an error (a 500), not a 404.
  if (!z.uuid().safeParse(requestId).success) return { kind: "missing" };
  return (await repo.requestExists(requestId)) ? { kind: "forbidden" } : { kind: "missing" };
}
