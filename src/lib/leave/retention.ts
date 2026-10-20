import { ACCRUAL_TIME_ZONE } from "@/lib/leave/accrual";
import { logger } from "@/lib/logger";

/**
 * BR-04: decision records are kept for a minimum of 3 years and never hard-deleted. A request decided
 * more than 3 years ago is soft-deleted (is_deleted), so the rows stay in the database but the app no
 * longer shows them. The 3 years is fixed inside the SQL function (migration 0008); it is not an input.
 */
export interface RetentionRepo {
  /** Soft-deletes requests decided more than 3 years before `asOf` and returns how many. */
  archiveExpired(asOf: string): Promise<number>;
}

export interface RetentionResult {
  /** Today's date in Asia/Manila, `YYYY-MM-DD`: the date the 3 years were counted back from. */
  asOf: string;
  /** Requests soft-deleted by this run. */
  archived: number;
}

/** Today's date in the company's calendar (the accrual clock), never the server's own zone. */
export function retentionDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ACCRUAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const [y, m, d] = [get("year"), get("month"), get("day")];
  if (!y || !m || !d) throw new Error("Could not work out today's date for retention.");
  return `${y}-${m}-${d}`;
}

/** Safe to run any number of times: the database makes a repeat a no-op. */
export async function runRetention(
  repo: RetentionRepo,
  now: Date = new Date(),
): Promise<RetentionResult> {
  const asOf = retentionDate(now);
  const archived = await repo.archiveExpired(asOf);
  logger.info("retention_run", { asOf, archived });
  return { asOf, archived };
}
