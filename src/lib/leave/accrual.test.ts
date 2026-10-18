import { describe, expect, it, vi } from "vitest";
import {
  ACCRUAL_TIME_ZONE,
  currentAccrualMonth,
  runAccrual,
  type AccrualRepo,
  type AccrualResult,
} from "@/lib/leave/accrual";

describe("currentAccrualMonth (Asia/Manila)", () => {
  it("names the company time zone explicitly", () => {
    expect(ACCRUAL_TIME_ZONE).toBe("Asia/Manila");
  });

  it("is the first day of the month", () => {
    expect(currentAccrualMonth(new Date("2026-10-16T01:46:14Z"))).toBe("2026-10-01");
  });

  it("rolls over at midnight in Manila (16:00 UTC), not at midnight UTC", () => {
    // 15:59:59 UTC = 23:59:59 in Manila on 31 October: still October.
    expect(currentAccrualMonth(new Date("2026-10-31T15:59:59Z"))).toBe("2026-10-01");
    // 16:00:00 UTC = 00:00:00 in Manila on 1 November: November.
    expect(currentAccrualMonth(new Date("2026-10-31T16:00:00Z"))).toBe("2026-11-01");
    // 00:00 UTC on the 1st is already 08:00 on the 1st in Manila: November, the same answer as UTC.
    expect(currentAccrualMonth(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11-01");
  });

  it("handles year end and leap years", () => {
    expect(currentAccrualMonth(new Date("2026-12-31T15:59:59Z"))).toBe("2026-12-01");
    expect(currentAccrualMonth(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
    expect(currentAccrualMonth(new Date("2028-02-29T10:00:00Z"))).toBe("2028-02-01");
    expect(currentAccrualMonth(new Date("2028-02-29T16:00:00Z"))).toBe("2028-03-01");
  });

  it("the 02:00 UTC cron on the 1st lands on the same month in Manila as in UTC", () => {
    // 02:00 UTC on the 1st = 10:00 in Manila on the 1st.
    expect(currentAccrualMonth(new Date("2026-11-01T02:00:00Z"))).toBe("2026-11-01");
  });

  it("does not depend on the machine's own time zone", () => {
    const original = process.env.TZ;
    try {
      for (const tz of ["UTC", "America/Los_Angeles", "Pacific/Kiritimati", "Asia/Manila"]) {
        process.env.TZ = tz;
        expect(currentAccrualMonth(new Date("2026-10-31T16:00:00Z"))).toBe("2026-11-01");
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe("runAccrual", () => {
  const result: AccrualResult = { month: "2026-11-01", accrued: 14, skipped: 0, alreadyRun: false };

  it("asks the repo for exactly the current Manila month, nothing else", async () => {
    const repo = { runMonthlyAccrual: vi.fn(async () => result) } satisfies AccrualRepo;
    const out = await runAccrual(repo, new Date("2026-10-31T16:00:00Z"));
    expect(repo.runMonthlyAccrual).toHaveBeenCalledTimes(1);
    expect(repo.runMonthlyAccrual).toHaveBeenCalledWith("2026-11-01");
    expect(out).toEqual(result);
  });

  it("returns a no-op result unchanged (a repeat in the same month)", async () => {
    const repeat: AccrualResult = {
      month: "2026-11-01",
      accrued: 0,
      skipped: 14,
      alreadyRun: true,
    };
    const repo = { runMonthlyAccrual: vi.fn(async () => repeat) } satisfies AccrualRepo;
    expect(await runAccrual(repo, new Date("2026-11-20T00:00:00Z"))).toEqual(repeat);
  });

  it("lets a database failure propagate (the route turns it into a generic 500)", async () => {
    const repo = {
      runMonthlyAccrual: vi.fn(async () => Promise.reject(new Error("db down"))),
    } satisfies AccrualRepo;
    await expect(runAccrual(repo)).rejects.toThrow("db down");
  });
});
