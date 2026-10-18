import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findUserByEmail = vi.fn();
const listBalances = vi.fn();
const listRequests = vi.fn();
const listTeamRequests = vi.fn();

vi.mock("@/lib/session", () => ({ getSession: () => getSession() }));
// Replaces the server-only Supabase repo, so no database is touched.
vi.mock("@/lib/leave/repo", () => ({
  createLeaveRepo: () => ({
    findUserByEmail,
    listLeaveTypes: async () => [{ id: "t-vac", name: "Vacation", tracksBalance: true }],
    listBalances,
    listRequests,
    listTeamRequests,
    requestExists: async () => false,
  }),
}));

import { GET } from "@/app/api/leave-requests/route";

const get = (query: string) => GET(new Request(`http://localhost/api/leave-requests${query}`));

const teamRow = {
  id: "r-1",
  userId: "emp-1",
  employeeName: "Ana Cruz",
  leaveTypeId: "t-vac",
  startDate: "2026-11-02",
  endDate: "2026-11-04",
  reason: "x",
  status: "pending",
  decidedBy: null,
  decidedAt: null,
  isDeleted: false,
  createdAt: "2026-10-10T00:00:00Z",
};

beforeEach(() => {
  for (const fn of [getSession, findUserByEmail, listBalances, listRequests, listTeamRequests]) {
    fn.mockReset();
  }
  findUserByEmail.mockResolvedValue({ id: "user-1", managerId: null, role: "employee" });
  listBalances.mockResolvedValue([
    {
      leaveTypeId: "t-vac",
      balance: 3,
      updatedAt: "2026-10-01T00:00:00+00:00",
      lastAccruedMonth: "2026-10-01",
    },
  ]);
  listRequests.mockResolvedValue([]);
  listTeamRequests.mockResolvedValue([teamRow]);
});

describe("GET /api/leave-requests?scope=mine", () => {
  it("401s without a session", async () => {
    getSession.mockResolvedValue(null);
    const res = await get("?scope=mine");
    expect(res.status).toBe(401);
    expect(listBalances).not.toHaveBeenCalled();
  });

  it("403s for an HR admin", async () => {
    getSession.mockResolvedValue({ role: "hr_admin", user: { email: "hana@example.com" } });
    expect((await get("?scope=mine")).status).toBe(403);
    expect(listBalances).not.toHaveBeenCalled();
  });

  it.each(["", "?scope=all", "?scope=", "?scope=MINE"])("400s for %s", async (query) => {
    getSession.mockResolvedValue({ role: "manager", user: { email: "maria@example.com" } });
    const res = await get(query);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(listBalances).not.toHaveBeenCalled();
    expect(listTeamRequests).not.toHaveBeenCalled();
  });

  it("200s with requests and balances for an employee and a manager", async () => {
    for (const role of ["employee", "manager"] as const) {
      getSession.mockResolvedValue({ role, user: { email: "ana@example.com" } });
      const res = await get("?scope=mine");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.balances[0]).toMatchObject({ leaveTypeName: "Vacation", confirmed: 3 });
      expect(json.data.requests).toEqual([]);
    }
  });

  it("only ever reads the session user: a userId parameter has no effect", async () => {
    getSession.mockResolvedValue({ role: "employee", user: { email: "ana@example.com" } });
    await get("?scope=mine&userId=someone-else&email=maria@example.com");
    expect(findUserByEmail).toHaveBeenCalledWith("ana@example.com");
    expect(listBalances).toHaveBeenCalledWith("user-1");
  });

  it("returns a generic 500 when the database fails", async () => {
    getSession.mockResolvedValue({ role: "employee", user: { email: "ana@example.com" } });
    findUserByEmail.mockRejectedValue(new Error("connection string with secret"));
    const res = await get("?scope=mine");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});

describe("GET /api/leave-requests?scope=team", () => {
  const asManager = () => {
    getSession.mockResolvedValue({ role: "manager", user: { email: "maria@example.com" } });
    findUserByEmail.mockResolvedValue({ id: "mgr-1", managerId: null, role: "manager" });
  };

  it("401s without a session", async () => {
    getSession.mockResolvedValue(null);
    expect((await get("?scope=team")).status).toBe(401);
    expect(listTeamRequests).not.toHaveBeenCalled();
  });

  it("403s for an employee and for an HR admin, and never queries the team", async () => {
    for (const role of ["employee", "hr_admin"] as const) {
      getSession.mockResolvedValue({ role, user: { email: "x@example.com" } });
      const res = await get("?scope=team");
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
    }
    expect(listTeamRequests).not.toHaveBeenCalled();
  });

  it("403s when the session says manager but the database role is not", async () => {
    getSession.mockResolvedValue({ role: "manager", user: { email: "ana@example.com" } });
    findUserByEmail.mockResolvedValue({ id: "emp-9", managerId: null, role: "employee" });
    expect((await get("?scope=team")).status).toBe(403);
    expect(listTeamRequests).not.toHaveBeenCalled();
  });

  it("200s with the team's requests for a manager, with names and no emails", async () => {
    asManager();
    const res = await get("?scope=team");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.requests).toHaveLength(1);
    expect(json.data.requests[0]).toMatchObject({
      employeeName: "Ana Cruz",
      leaveTypeName: "Vacation",
    });
    expect(JSON.stringify(json)).not.toContain("@");
  });

  it("scopes by the session user only: team/manager parameters have no effect", async () => {
    asManager();
    await get("?scope=team&managerId=someone-else&userId=other&email=paolo@example.com");
    expect(findUserByEmail).toHaveBeenCalledWith("maria@example.com");
    expect(listTeamRequests).toHaveBeenCalledTimes(1);
    expect(listTeamRequests).toHaveBeenCalledWith("mgr-1");
  });

  it("returns a generic 500 when the database fails", async () => {
    asManager();
    listTeamRequests.mockRejectedValue(new Error("rpc failed with secret detail"));
    const res = await get("?scope=team");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
