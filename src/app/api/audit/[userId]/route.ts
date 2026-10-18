import { errorResponse, okResponse, toErrorResponse } from "@/lib/errors";
import { getAuditReport } from "@/lib/leave/audit";
import { createLeaveRepo } from "@/lib/leave/repo";
import { auditQuerySchema } from "@/lib/leave/validate";
import { logger } from "@/lib/logger";
import { getSession } from "@/lib/session";

/**
 * US-05: one employee's full decision history. HR admins only.
 * Optional `from` / `to` (YYYY-MM-DD) keep requests whose leave dates overlap that range.
 * The soft-delete exclusion is enforced inside the SQL function behind the repo.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Authentication required.", 401);
    if (session.role !== "hr_admin") {
      return errorResponse("FORBIDDEN", "You do not have access to this resource.", 403);
    }

    const params = new URL(request.url).searchParams;
    const parsed = auditQuerySchema.safeParse({
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
    });
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid request.",
        400,
      );
    }

    const { userId } = await context.params;
    const report = await getAuditReport(createLeaveRepo(), session.user.email, userId, parsed.data);
    return okResponse(report);
  } catch (err) {
    logger.error("audit report failed", { err: String(err) });
    return toErrorResponse(err);
  }
}
