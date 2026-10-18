import { okResponse, toErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

export function GET(): Response {
  try {
    return okResponse({ status: "ok" });
  } catch (err) {
    logger.error("health check failed", { err: String(err) });
    return toErrorResponse(err);
  }
}
