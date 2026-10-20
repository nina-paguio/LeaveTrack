import { describe, expect, it, vi } from "vitest";
import { retentionDate, runRetention } from "@/lib/leave/retention";

describe("retentionDate", () => {
  it("uses today's date in Manila, not the server's zone", () => {
    // 15:59:59 UTC on 31 Oct is still 31 Oct in Manila; one second later it is 1 Nov.
    expect(retentionDate(new Date("2026-10-31T15:59:59Z"))).toBe("2026-10-31");
    expect(retentionDate(new Date("2026-10-31T16:00:00Z"))).toBe("2026-11-01");
    expect(retentionDate(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01-01");
  });
});

describe("runRetention", () => {
  it("asks the database to archive as of today and reports how many", async () => {
    const repo = { archiveExpired: vi.fn(async () => 3) };
    const result = await runRetention(repo, new Date("2026-10-19T08:00:00Z"));
    expect(repo.archiveExpired).toHaveBeenCalledWith("2026-10-19");
    expect(result).toEqual({ asOf: "2026-10-19", archived: 3 });
  });

  it("passes only a date: there is no way to choose a different age", async () => {
    const repo = { archiveExpired: vi.fn(async () => 0) };
    await runRetention(repo);
    expect(repo.archiveExpired.mock.calls[0]).toHaveLength(1);
  });

  it("lets a database error through instead of pretending it worked", async () => {
    const repo = { archiveExpired: vi.fn(async () => Promise.reject(new Error("db down"))) };
    await expect(runRetention(repo)).rejects.toThrow("db down");
  });
});
