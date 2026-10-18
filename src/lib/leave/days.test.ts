import { describe, expect, it } from "vitest";
import { inclusiveDays } from "@/lib/leave/days";

describe("inclusiveDays", () => {
  it("counts a single day as 1", () => {
    expect(inclusiveDays("2026-11-02", "2026-11-02")).toBe(1);
  });

  it("is inclusive of both ends and counts weekends", () => {
    expect(inclusiveDays("2026-11-02", "2026-11-04")).toBe(3);
    expect(inclusiveDays("2026-11-06", "2026-11-09")).toBe(4);
  });

  it("is not thrown off by month ends or daylight-saving changes", () => {
    expect(inclusiveDays("2026-01-30", "2026-02-02")).toBe(4);
    expect(inclusiveDays("2026-03-07", "2026-03-09")).toBe(3);
    expect(inclusiveDays("2026-10-30", "2026-11-02")).toBe(4);
  });

  it("agrees with the SQL rule used when approving (end - start + 1), across a year end", () => {
    // supabase/verify-decide.sql approves this exact range and expects a 4-day deduction.
    expect(inclusiveDays("2026-12-30", "2027-01-02")).toBe(4);
    expect(inclusiveDays("2026-12-01", "2026-12-03")).toBe(3);
    expect(inclusiveDays("2026-12-20", "2026-12-21")).toBe(2);
  });
});
