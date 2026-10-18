import { errorResponse, okResponse, toErrorResponse } from "@/lib/errors";
import { getMyLeave } from "@/lib/leave/mine";
import { createLeaveRepo } from "@/lib/leave/repo";
import { submitLeaveRequest } from "@/lib/leave/submit";
import { getTeamRequests } from "@/lib/leave/team";
import { submitLeaveRequestSchema } from "@/lib/leave/validate";
import { logger } from "@/lib/logger";
import { getSession } from "@/lib/session";

/**
 * - `scope=mine` (US-02): the caller's own requests and balances. Employees only (the docs give
 *   submitting and balances to the Employee role; a manager only approves).
 * - `scope=team` (US-04): requests from the caller's direct reports. Managers only.
 *
 * Identity comes only from the session, so no query parameter can select another user or team.
 * The team scope itself is enforced inside the SQL function behind `listTeamRequests`.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Authentication required.", 401);
    if (session.role === "hr_admin") {
      return errorResponse("FORBIDDEN", "You do not have access to this resource.", 403);
    }

    const scope = new URL(request.url).searchParams.get("scope");

    if (scope === "team") {
      if (session.role !== "manager") {
        return errorResponse("FORBIDDEN", "You do not have access to this resource.", 403);
      }
      const requests = await getTeamRequests(createLeaveRepo(), session.user.email);
      return okResponse({ requests });
    }

    if (scope === "mine" && session.role !== "employee") {
      return errorResponse("FORBIDDEN", "You do not have access to this resource.", 403);
    }

    if (scope !== "mine") {
      return errorResponse(
        "VALIDATION_ERROR",
        "Unsupported or missing scope. Use scope=mine or scope=team.",
        400,
      );
    }

    return okResponse(await getMyLeave(createLeaveRepo(), session.user.email));
  } catch (err) {
    logger.error("load leave requests failed", { err: String(err) });
    return toErrorResponse(err);
  }
}

/** US-01: submit a leave request. Employees only: the docs give submitting to the Employee role. */
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Authentication required.", 401);
    if (session.role !== "employee") {
      return errorResponse("FORBIDDEN", "You do not have access to this resource.", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "Request body must be valid JSON.", 400);
    }

    // Validate first: an invalid request never reaches the database (AC2).
    const parsed = submitLeaveRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid request.",
        400,
      );
    }

    const result = await submitLeaveRequest(createLeaveRepo(), session.user.email, parsed.data);
    return okResponse(result, 201);
  } catch (err) {
    logger.error("submit leave request failed", { err: String(err) });
    return toErrorResponse(err);
  }
}
