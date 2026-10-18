import { describe, expect, it, vi } from "vitest";
import { getAuditReport, type AuditEntry, type AuditRepo } from "@/lib/leave/audit";
import type { Role } from "@/types/domain";

const SUBJECT_ID = "6f1c2a3e-8b4d-4e5f-9a6b-1c2d3e4f5a6b";

const entry = (over: Partial<AuditEntry> = {}): AuditEntry => ({
  id: "r-1",
  leaveTypeName: "Vacation",
  startDate: "2026-11-02",
  endDate: "2026-11-04",
  status: "approved",
  createdAt: "2026-10-30T00:00:00Z",
  decidedByName: "Maria Santos",
  decidedAt: "2026-11-01T10:00:00Z",
  decisionReason: null,
  ...over,
});

function fakeRepo(role: Role = "hr_admin", over: Partial<AuditRepo> = {}) {
  return {
    findUserByEmail: vi.fn(async () => ({ id: "hr-1", managerId: null, role })),
    findUserById: vi.fn(async () => ({
      id: SUBJECT_ID,
      name: "Ana Cruz",
      role: "employee" as const,
    })),
    auditReport: vi.fn(async () => [entry()]),
    ...over,
  } satisfies AuditRepo;
}

describe("getAuditReport", () => {
  it("AC1: returns the employee and every request the repo returns, unfiltered", async () => {
    const rows = [
      entry({ id: "a" }),
      entry({ id: "b", status: "pending", decidedAt: null, decidedByName: null }),
    ];
    const repo = fakeRepo("hr_admin", { auditReport: vi.fn(async () => rows) });
    const report = await getAuditReport(repo, "hana@example.com", SUBJECT_ID, {});
    expect(report.employee).toEqual({ id: SUBJECT_ID, name: "Ana Cruz" });
    expect(report.requests).toEqual(rows);
    expect(report.filters).toEqual({ from: null, to: null });
  });

  it("asks the repo for exactly the requested employee and range", async () => {
    const repo = fakeRepo();
    const range = { from: "2026-01-01", to: "2026-12-31" };
    const report = await getAuditReport(repo, "hana@example.com", SUBJECT_ID, range);
    expect(repo.auditReport).toHaveBeenCalledWith(SUBJECT_ID, range);
    expect(report.filters).toEqual(range);
  });

  it("403s unless the DATABASE role is hr_admin, whatever the session said, and reads nothing", async () => {
    for (const role of ["employee", "manager"] as const) {
      const repo = fakeRepo(role);
      await expect(getAuditReport(repo, "x@example.com", SUBJECT_ID, {})).rejects.toMatchObject({
        status: 403,
      });
      expect(repo.findUserById).not.toHaveBeenCalled();
      expect(repo.auditReport).not.toHaveBeenCalled();
    }
  });

  it("404s a malformed id without asking the database, but only after the role check", async () => {
    const repo = fakeRepo();
    for (const id of ["not-a-uuid", "", "1", "' or 1=1 --"]) {
      await expect(getAuditReport(repo, "hana@example.com", id, {})).rejects.toMatchObject({
        status: 404,
      });
    }
    expect(repo.findUserById).not.toHaveBeenCalled();
    expect(repo.auditReport).not.toHaveBeenCalled();

    const manager = fakeRepo("manager");
    await expect(getAuditReport(manager, "x@example.com", "not-a-uuid", {})).rejects.toMatchObject({
      status: 403,
    });
  });

  it("404s an unknown employee and reports nothing", async () => {
    const repo = fakeRepo("hr_admin", { findUserById: vi.fn(async () => null) });
    await expect(getAuditReport(repo, "hana@example.com", SUBJECT_ID, {})).rejects.toMatchObject({
      status: 404,
    });
    expect(repo.auditReport).not.toHaveBeenCalled();
  });

  it("404s an unknown caller", async () => {
    const repo = fakeRepo("hr_admin", { findUserByEmail: vi.fn(async () => null) });
    await expect(getAuditReport(repo, "nobody@example.com", SUBJECT_ID, {})).rejects.toMatchObject({
      status: 404,
    });
  });

  it("has no field that could carry the employee's own free-text reason", async () => {
    const report = await getAuditReport(fakeRepo(), "hana@example.com", SUBJECT_ID, {});
    for (const row of report.requests) expect(Object.keys(row)).not.toContain("reason");
  });
});
