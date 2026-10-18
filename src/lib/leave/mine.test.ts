import { describe, expect, it, vi } from "vitest";
import { getMyLeave, type MineRepo } from "@/lib/leave/mine";
import type { LeaveRequest } from "@/types/domain";

const VAC = { id: "t-vac", name: "Vacation", tracksBalance: true };
const SICK = { id: "t-sick", name: "Sick", tracksBalance: true };
const UNPAID = { id: "t-unpaid", name: "Unpaid", tracksBalance: false };

const request = (over: Partial<LeaveRequest>): LeaveRequest => ({
  id: "r",
  userId: "user-1",
  leaveTypeId: VAC.id,
  startDate: "2026-11-02",
  endDate: "2026-11-04",
  reason: "x",
  status: "pending",
  decidedBy: null,
  decidedAt: null,
  isDeleted: false,
  createdAt: "2026-10-10T00:00:00Z",
  ...over,
});

function fakeRepo(over: Partial<MineRepo> = {}): MineRepo {
  return {
    findUserByEmail: vi.fn(async () => ({
      id: "user-1",
      managerId: null,
      role: "employee" as const,
    })),
    // Deliberately out of display order: the service must sort them.
    listLeaveTypes: vi.fn(async () => [UNPAID, SICK, VAC]),
    listBalances: vi.fn(async () => [
      {
        leaveTypeId: VAC.id,
        balance: 12.5,
        updatedAt: "2026-10-20T02:00:00+00:00",
        lastAccruedMonth: "2026-10-01",
      },
      {
        leaveTypeId: SICK.id,
        balance: 5,
        updatedAt: "2026-10-03T02:00:00+00:00",
        lastAccruedMonth: "2026-09-01",
      },
    ]),
    listRequests: vi.fn(async () => []),
    ...over,
  };
}

const byName = (balances: Awaited<ReturnType<typeof getMyLeave>>["balances"], name: string) =>
  balances.find((b) => b.leaveTypeName === name);

describe("getMyLeave", () => {
  it("AC1: returns the confirmed balance per leave type, in display order", async () => {
    const { balances } = await getMyLeave(fakeRepo(), "ana@example.com");
    expect(balances.map((b) => b.leaveTypeName)).toEqual(["Vacation", "Sick", "Unpaid"]);
    expect(byName(balances, "Vacation")?.confirmed).toBe(12.5);
    expect(byName(balances, "Sick")?.confirmed).toBe(5);
  });

  it("uses the latest ACCRUED month as the as-of date (not the latest update)", async () => {
    const { balances } = await getMyLeave(fakeRepo(), "ana@example.com");
    // Vacation was accrued through October, Sick only through September: the page shows the latest.
    expect(balances.every((b) => b.asOf === "2026-10-01")).toBe(true);
  });

  it("an approval touching updated_at does not move the as-of date", async () => {
    const repo = fakeRepo({
      listBalances: vi.fn(async () => [
        {
          leaveTypeId: VAC.id,
          balance: 9,
          updatedAt: "2026-12-30T00:00:00+00:00",
          lastAccruedMonth: "2026-10-01",
        },
      ]),
    });
    const { balances } = await getMyLeave(repo, "ana@example.com");
    expect(balances[0]?.asOf).toBe("2026-10-01");
  });

  it("has no as-of date until a first accrual has run", async () => {
    const repo = fakeRepo({
      listBalances: vi.fn(async () => [
        {
          leaveTypeId: VAC.id,
          balance: 0,
          updatedAt: "2026-10-16T00:00:00+00:00",
          lastAccruedMonth: null,
        },
      ]),
    });
    const { balances } = await getMyLeave(repo, "ana@example.com");
    expect(balances.every((b) => b.asOf === null)).toBe(true);
  });

  it("has no as-of date when no balance row exists", async () => {
    const repo = fakeRepo({ listBalances: vi.fn(async () => []) });
    const { balances } = await getMyLeave(repo, "ana@example.com");
    expect(balances.every((b) => b.asOf === null)).toBe(true);
    expect(byName(balances, "Vacation")?.confirmed).toBe(0);
  });

  it("AC2: pending days are separate from confirmed and sum inclusive days per type", async () => {
    const repo = fakeRepo({
      listRequests: vi.fn(async () => [
        request({ id: "a", startDate: "2026-11-02", endDate: "2026-11-04" }), // 3 vacation days
        request({ id: "b", startDate: "2026-12-01", endDate: "2026-12-01" }), // 1 vacation day
        request({ id: "c", leaveTypeId: SICK.id, startDate: "2026-11-10", endDate: "2026-11-11" }), // 2 sick
      ]),
    });
    const { balances } = await getMyLeave(repo, "ana@example.com");
    expect(byName(balances, "Vacation")).toMatchObject({ confirmed: 12.5, pending: 4 });
    expect(byName(balances, "Sick")).toMatchObject({ confirmed: 5, pending: 2 });
  });

  it("does not count approved, rejected or soft-deleted requests as pending", async () => {
    const repo = fakeRepo({
      listRequests: vi.fn(async () => [
        request({ id: "a", status: "approved" }),
        request({ id: "b", status: "rejected" }),
        request({ id: "c", isDeleted: true }),
      ]),
    });
    const { balances, requests } = await getMyLeave(repo, "ana@example.com");
    expect(byName(balances, "Vacation")?.pending).toBe(0);
    expect(requests.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("US-08: Unpaid has no balance and no pending figure", async () => {
    const repo = fakeRepo({
      listRequests: vi.fn(async () => [request({ leaveTypeId: UNPAID.id })]),
    });
    const { balances } = await getMyLeave(repo, "ana@example.com");
    expect(byName(balances, "Unpaid")).toMatchObject({
      tracksBalance: false,
      confirmed: 0,
      pending: 0,
    });
  });

  it("lists requests newest first", async () => {
    const repo = fakeRepo({
      listRequests: vi.fn(async () => [
        request({ id: "old", createdAt: "2026-09-01T00:00:00Z" }),
        request({ id: "new", createdAt: "2026-10-15T00:00:00Z" }),
      ]),
    });
    const { requests } = await getMyLeave(repo, "ana@example.com");
    expect(requests.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("reads only the resolved user's data and 404s for an unknown user", async () => {
    const repo = fakeRepo();
    await getMyLeave(repo, "ana@example.com");
    expect(repo.listBalances).toHaveBeenCalledWith("user-1");
    expect(repo.listRequests).toHaveBeenCalledWith("user-1");

    const unknown = fakeRepo({ findUserByEmail: vi.fn(async () => null) });
    await expect(getMyLeave(unknown, "nobody@example.com")).rejects.toMatchObject({ status: 404 });
    expect(unknown.listBalances).not.toHaveBeenCalled();
  });
});
