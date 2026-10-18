import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { errorResponse, okResponse, toErrorResponse } from "@/lib/errors";
import { runAccrual } from "@/lib/leave/accrual";
import { createLeaveRepo } from "@/lib/leave/repo";
import { logger } from "@/lib/logger";

// Never cache or pre-render: every call must reach the handler.
export const dynamic = "force-dynamic";

/** Constant-time check of `Authorization: Bearer <secret>` (no early exit on the first wrong byte). */
function hasValidSecret(request: Request, secret: string): boolean {
  const match = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "");
  if (!match?.[1]) return false;
  const given = Buffer.from(match[1]);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * US-07: the monthly accrual. Called by Vercel Cron (which sends GET with the CRON_SECRET as a bearer
 * token) or by hand (POST, as the ARCH doc says). Both do exactly the same thing, and a repeat in the
 * same month is a no-op in the database (ADR-LeaveTrack-E002). This route is exempt from the login
 * proxy (it has no session), so the bearer secret is the only gate: it fails closed.
 */
async function handle(request: Request): Promise<Response> {
  try {
    const secret = env.CRON_SECRET;
    if (!secret) {
      logger.error("accrual refused: CRON_SECRET is not configured");
      return errorResponse("INTERNAL_ERROR", "Accrual is not configured.", 503);
    }
    if (!hasValidSecret(request, secret)) {
      return errorResponse("UNAUTHENTICATED", "Authentication required.", 401);
    }

    return okResponse(await runAccrual(createLeaveRepo()));
  } catch (err) {
    logger.error("monthly accrual failed", { err: String(err) });
    return toErrorResponse(err);
  }
}

export const GET = handle;
export const POST = handle;
