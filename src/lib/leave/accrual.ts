import { logger } from "@/lib/logger";

/**
 * The company's calendar for accrual. The Philippines has no daylight saving, so this is a fixed
 * UTC+8, but the zone is named explicitly so the month never depends on where the server runs.
 */
export const ACCRUAL_TIME_ZONE = "Asia/Manila";

export interface AccrualResult {
  /** First day of the month that was run, `YYYY-MM-01`. */
  month: string;
  /** Balance rows that were raised by this run. */
  accrued: number;
  /** Tracked policies that were already accrued for this month (or a later one). */
  skipped: number;
  /** True when this run changed nothing because the month was already accrued. */
  alreadyRun: boolean;
}

/** Write access for the monthly accrual. The work is one atomic, idempotent SQL function. */
export interface AccrualRepo {
  runMonthlyAccrual(month: string): Promise<AccrualResult>;
}

/**
 * The month to accrue: the first day of the current month in Asia/Manila.
 * At 15:59:59 UTC on 31 October it is still October in Manila; at 16:00:00 UTC it is November.
 * There is deliberately no way to pass a different month (no accidental future or back-dated run).
 */
export function currentAccrualMonth(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ACCRUAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  if (!year || !month) throw new Error("Could not work out the current accrual month.");
  return `${year}-${month}-01`;
}

/** US-07. Safe to call any number of times in a month: the database makes repeats a no-op. */
export async function runAccrual(
  repo: AccrualRepo,
  now: Date = new Date(),
): Promise<AccrualResult> {
  const result = await repo.runMonthlyAccrual(currentAccrualMonth(now));
  logger.info("monthly_accrual_run", {
    month: result.month,
    accrued: result.accrued,
    skipped: result.skipped,
    alreadyRun: result.alreadyRun,
  });
  return result;
}
