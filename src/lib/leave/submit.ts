import { AppError } from "@/lib/errors";
import { inclusiveDays } from "@/lib/leave/days";
import type { SubmitLeaveRequestInput } from "@/lib/leave/validate";
import { logger } from "@/lib/logger";
import type { RequestStatus, Role } from "@/types/domain";

export interface RepoUser {
  id: string;
  managerId: string | null;
  /** The role stored in the database, which services trust over the session cookie. */
  role: Role;
}

export interface RepoLeaveType {
  id: string;
  name: string;
  tracksBalance: boolean;
}

export interface CreatedRequest {
  id: string;
  status: RequestStatus;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  createdAt: string;
}

/** Data access the service needs. The Supabase implementation lives in repo.ts (server-only). */
export interface LeaveRepo {
  findUserByEmail(email: string): Promise<RepoUser | null>;
  findLeaveType(id: string): Promise<RepoLeaveType | null>;
  getBalance(userId: string, leaveTypeId: string): Promise<number | null>;
  createRequest(userId: string, input: SubmitLeaveRequestInput): Promise<CreatedRequest>;
}

export interface OverBalanceWarning {
  code: "OVER_BALANCE";
  message: string;
  requestedDays: number;
  balance: number;
}

export interface SubmitResult {
  request: CreatedRequest;
  warning: OverBalanceWarning | null;
}

/**
 * US-01. `input` must already be validated (submitLeaveRequestSchema): nothing here runs for
 * invalid input, so no row is ever created for a bad date range (AC2).
 * Over-balance warns but never blocks (AC3). Unpaid has no balance, so it is never warned (US-08 AC2).
 */
export async function submitLeaveRequest(
  repo: LeaveRepo,
  actorEmail: string,
  input: SubmitLeaveRequestInput,
): Promise<SubmitResult> {
  const user = await repo.findUserByEmail(actorEmail);
  if (!user) throw new AppError("NOT_FOUND", "Your user profile was not found.", 404);

  const leaveType = await repo.findLeaveType(input.leaveTypeId);
  if (!leaveType) throw new AppError("NOT_FOUND", "Leave type not found.", 404);

  let warning: OverBalanceWarning | null = null;
  if (leaveType.tracksBalance) {
    const balance = (await repo.getBalance(user.id, leaveType.id)) ?? 0;
    const requestedDays = inclusiveDays(input.startDate, input.endDate);
    if (requestedDays > balance) {
      warning = {
        code: "OVER_BALANCE",
        message: `This request is ${requestedDays} days but your remaining ${leaveType.name} balance is ${balance} days. HR can override.`,
        requestedDays,
        balance,
      };
    }
  }

  const request = await repo.createRequest(user.id, input);

  // "Notifies the manager" (AC1): the audit row is written by the database function; there is no
  // email/notification infrastructure yet, so a structured log line is the notification for now.
  logger.info("leave_request_submitted", {
    requestId: request.id,
    managerId: user.managerId,
    overBalance: warning !== null,
  });

  return { request, warning };
}
