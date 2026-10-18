import { errorResponse, okResponse, toErrorResponse } from "@/lib/errors";
import { decideLeaveRequest } from "@/lib/leave/decide";
import { createLeaveRepo } from "@/lib/leave/repo";
import { decideLeaveRequestSchema } from "@/lib/leave/validate";
import { logger } from "@/lib/logger";
import { getSession } from "@/lib/session";

/**
 * US-03: approve or reject a direct report's pending request. Managers only.
 * The manager is the session user: no body or query value can name another one. The scope,
 * exactly-once and balance rules are enforced inside the SQL function behind the repo.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Authentication required.", 401);
    if (session.role !== "manager") {
      return errorResponse("FORBIDDEN", "You do not have access to this resource.", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "Request body must be valid JSON.", 400);
    }

    const parsed = decideLeaveRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid request.",
        400,
      );
    }

    const { id } = await context.params;
    const decided = await decideLeaveRequest(
      createLeaveRepo(),
      session.user.email,
      id,
      parsed.data,
    );
    return okResponse({ request: decided });
  } catch (err) {
    logger.error("decide leave request failed", { err: String(err) });
    return toErrorResponse(err);
  }
}
