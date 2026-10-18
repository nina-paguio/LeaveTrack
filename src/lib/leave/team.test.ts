import { describe, expect, it, vi } from "vitest";
import {
  getTeamRequest,
  getTeamRequests,
  type RepoTeamRequest,
  type TeamRepo,
} from "@/lib/leave/team";

const VAC = { id: "t-vac", name: "Vacation", tracksBalance: true };
const UNPAID = { id: "t-unpaid", name: "Unpaid", tracksBalance: false };

const row = (over: Partial<RepoTeamRequest>): RepoTeamRequest => ({
  id: "r",
  userId: "emp-1",
  employeeName: "Ana Cruz",
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

function fakeRepo(over: Partial<TeamRepo> = {}): TeamRepo {
  return {
    findUserByEmail: vi.fn(async () => ({
      id: "mgr-1",
      managerId: null,
      role: "manager" as const,
    })),
    listLeaveTypes: vi.fn(async () => [VAC, UNPAID]),
    listTeamRequests: vi.fn(async () => []),
    requestExists: vi.fn(async () => false),
    ...over,
  };
}

describe("getTeamRequests", () => {
  it("asks the repo for exactly the resolved manager's id", async () => {
    const repo = fakeRepo();
    await getTeamRequests(repo, "maria@example.com");
    expect(repo.listTeamRequests).toHaveBeenCalledWith("mgr-1");
  });

  it("attaches employee and leave type names", async () => {
    const repo = fakeRepo({
      listTeamRequests: vi.fn(async () => [row({ id: "a", leaveTypeId: UNPAID.id })]),
    });
    const [first] = await getTeamRequests(repo, "maria@example.com");
    expect(first).toMatchObject({ employeeName: "Ana Cruz", leaveTypeName: "Unpaid" });
  });

  it("lists pending first, then newest first", async () => {
    const repo = fakeRepo({
      listTeamRequests: vi.fn(async () => [
        row({ id: "old-approved", status: "approved", createdAt: "2026-10-20T00:00:00Z" }),
        row({ id: "old-pending", createdAt: "2026-10-01T00:00:00Z" }),
        row({ id: "new-pending", createdAt: "2026-10-12T00:00:00Z" }),
      ]),
    });
    const ids = (await getTeamRequests(repo, "maria@example.com")).map((r) => r.id);
    expect(ids).toEqual(["new-pending", "old-pending", "old-approved"]);
  });

  it("drops soft-deleted rows even if the repo returned them", async () => {
    const repo = fakeRepo({
      listTeamRequests: vi.fn(async () => [row({ id: "a" }), row({ id: "b", isDeleted: true })]),
    });
    expect((await getTeamRequests(repo, "maria@example.com")).map((r) => r.id)).toEqual(["a"]);
  });

  it("returns an empty queue for a manager with no reports", async () => {
    expect(await getTeamRequests(fakeRepo(), "maria@example.com")).toEqual([]);
  });

  it("403s unless the DATABASE role is manager, whatever the session said", async () => {
    for (const role of ["employee", "hr_admin"] as const) {
      const repo = fakeRepo({
        findUserByEmail: vi.fn(async () => ({ id: "u-1", managerId: null, role })),
      });
      await expect(getTeamRequests(repo, "x@example.com")).rejects.toMatchObject({ status: 403 });
      expect(repo.listTeamRequests).not.toHaveBeenCalled();
    }
  });

  it("404s for an unknown user and queries nothing", async () => {
    const repo = fakeRepo({ findUserByEmail: vi.fn(async () => null) });
    await expect(getTeamRequests(repo, "nobody@example.com")).rejects.toMatchObject({
      status: 404,
    });
    expect(repo.listTeamRequests).not.toHaveBeenCalled();
  });
});

describe("getTeamRequest (US-03 AC3)", () => {
  it("finds a request in the manager's team", async () => {
    const repo = fakeRepo({ listTeamRequests: vi.fn(async () => [row({ id: "mine" })]) });
    const result = await getTeamRequest(repo, "maria@example.com", "mine");
    expect(result).toMatchObject({ kind: "found", request: { id: "mine" } });
  });

  it("is forbidden when the request exists but is not in the team, and is never returned", async () => {
    const repo = fakeRepo({
      listTeamRequests: vi.fn(async () => [row({ id: "mine" })]),
      requestExists: vi.fn(async () => true),
    });
    expect(
      await getTeamRequest(repo, "maria@example.com", "00000000-0000-4000-8000-0000000000aa"),
    ).toEqual({
      kind: "forbidden",
    });
  });

  it("is missing for a malformed id, without asking the database about it", async () => {
    const repo = fakeRepo({ requestExists: vi.fn(async () => true) });
    for (const id of ["not-a-uuid", "", "1", "' or 1=1 --"]) {
      expect(await getTeamRequest(repo, "maria@example.com", id)).toEqual({ kind: "missing" });
    }
    expect(repo.requestExists).not.toHaveBeenCalled();
  });

  it("still 403s a non-manager before it looks at the id", async () => {
    const repo = fakeRepo({
      findUserByEmail: vi.fn(async () => ({
        id: "u-1",
        managerId: null,
        role: "employee" as const,
      })),
    });
    await expect(getTeamRequest(repo, "x@example.com", "not-a-uuid")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("is missing when the request does not exist at all", async () => {
    expect(await getTeamRequest(fakeRepo(), "maria@example.com", "nope")).toEqual({
      kind: "missing",
    });
  });
});
