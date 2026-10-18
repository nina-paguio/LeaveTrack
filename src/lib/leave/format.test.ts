import { describe, expect, it } from "vitest";
import { formatDate, formatDateRange, formatDateTime } from "@/lib/leave/format";

describe("formatDateRange", () => {
  it("formats one day, one month, two months and two years", () => {
    expect(formatDateRange("2026-10-17", "2026-10-17")).toBe("Oct 17, 2026");
    expect(formatDateRange("2026-10-17", "2026-10-18")).toBe("Oct 17–18, 2026");
    expect(formatDateRange("2026-10-30", "2026-11-02")).toBe("Oct 30 – Nov 2, 2026");
    expect(formatDateRange("2026-12-30", "2027-01-02")).toBe("Dec 30, 2026 – Jan 2, 2027");
  });

  it("falls back to the raw text for unparseable input instead of throwing", () => {
    expect(formatDateRange("soon", "later")).toBe("soon to later");
    expect(formatDate("n/a")).toBe("n/a");
  });
});

describe("formatDateTime", () => {
  it("shows the time in Manila, not UTC", () => {
    expect(formatDateTime("2026-09-14T09:30:00Z")).toBe("Sep 14, 2026, 5:30 PM");
    // 20:00 UTC is already the next day in Manila
    expect(formatDateTime("2026-09-14T20:00:00Z")).toBe("Sep 15, 2026, 4:00 AM");
    expect(formatDateTime("not a date")).toBe("not a date");
  });
});
