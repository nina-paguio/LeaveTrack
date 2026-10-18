import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireManager, type TeamRepo } from "@/lib/leave/team";
import type { DecideLeaveRequestInput } from "@/lib/leave/validate";
import { logger } from "@/lib/logger";
import type { RequestStatus } from "@/types/domain";

export interface DecidedRequest {
  id: string;
  status: RequestStatus;
  decidedBy: string;
  decidedAt: string;
  decisionReason: string | null;
}

/** What decide_leave_request() (migration 0004) can refuse with. */
export type DecisionRefusal =
  "NOT_FOUND" | "FORBIDDEN" | "NOT_PENDING" | "REASON_REQUIRED" | "INVALID_DECISION";

export type DecideOutcome =
  { ok: true; request: DecidedRequest } | { ok: false; refusal: DecisionRefusal };

/**
 * The SQL function does the real work atomically: scope check, exactly-once check, status change,
 * balance change and audit row. It never filters by team here; this layer only maps results.
 */
export interface DecideRepo extends Pick<TeamRepo, "findUserByEmail"> {
  decideRequest(
    managerId: string,
    requestId: string,
    input: DecideLeaveRequestInput,
  ): Promise<DecideOutcome>;
}

/** Fresh error per throw, so each carries its own stack trace. */
const refusalError = (refusal: DecisionRefusal): AppError => {
  switch (refusal) {
    case "NOT_FOUND":
      return new AppError("NOT_FOUND", "Leave request not found.", 404);
    case "FORBIDDEN":
      return new AppError("FORBIDDEN", "You do not have access to this resource.", 403);
    case "NOT_PENDING":
      return new AppError("CONFLICT", "This request has already been decided.", 409);
    case "REASON_REQUIRED":
      return new AppError("VALIDATION_ERROR", "A reason is required to reject.", 400);
    case "INVALID_DECISION":
      return new AppError("VALIDATION_ERROR", "Decision must be approve or reject.", 400);
  }
};

/**
 * US-03. `input` must already be validated (decideLeaveRequestSchema).
 * Order matters: the manager check comes first, so a non-manager gets 403 whatever the id is;
 * only then is a malformed id a 404 (Postgres would raise an error, i.e. a 500, if asked).
 */
export async function decideLeaveRequest(
  repo: DecideRepo,
  email: string,
  requestId: string,
  input: DecideLeaveRequestInput,
): Promise<DecidedRequest> {
  const manager = await requireManager(repo, email);

  if (!z.uuid().safeParse(requestId).success) throw refusalError("NOT_FOUND");

  const outcome = await repo.decideRequest(manager.id, requestId, input);
  if (!outcome.ok) throw refusalError(outcome.refusal);

  // "Notifies the employee" (US-03): decide_leave_request wrote the in-app notification (and the
  // audit row) in the same transaction (migration 0007). This log line is for observability only.
  logger.info("leave_request_decided", {
    requestId,
    decision: input.decision,
    managerId: manager.id,
  });

  return outcome.request;
}
