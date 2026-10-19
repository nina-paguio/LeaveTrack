import { hasValidCronSecret } from "@/lib/auth/cron-auth";
import { env } from "@/lib/env";
import { errorResponse, okResponse, toErrorResponse } from "@/lib/errors";
import { createLeaveRepo } from "@/lib/leave/repo";
import { runRetention } from "@/lib/leave/retention";
import { logger } from "@/lib/logger";

// Never cache or pre-render: every call must reach the handler.
export const dynamic = "force-dynamic";

/**
 * BR-04: soft-deletes requests decided more than 3 years ago (rows stay in the database; the app stops
 * showing them). Called by Vercel Cron (GET, with the CRON_SECRET as a bearer token) or by hand (POST).
 * Both do exactly the same thing, and a repeat changes nothing. Like the accrual job this route has no
 * session and is exempt from the login proxy, so the bearer secret is the only gate: it fails closed.
 */
async function handle(request: Request): Promise<Response> {
  try {
    const secret = env.CRON_SECRET;
    if (!secret) {
      logger.error("retention refused: CRON_SECRET is not configured");
      return errorResponse("INTERNAL_ERROR", "Retention is not configured.", 503);
    }
    if (!hasValidCronSecret(request, secret)) {
      return errorResponse("UNAUTHENTICATED", "Authentication required.", 401);
    }

    return okResponse(await runRetention(createLeaveRepo()));
  } catch (err) {
    logger.error("retention run failed", { err: String(err) });
    return toErrorResponse(err);
  }
}

export const GET = handle;
export const POST = handle;
