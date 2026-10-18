import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findUserByEmail = vi.fn();
const findUserById = vi.fn();
const auditReport = vi.fn();

vi.mock("@/lib/session", () => ({ getSession: () => getSession() }));
// Replaces the server-only Supabase repo, so no database is touched.
vi.mock("@/lib/leave/repo", () => ({
  createLeaveRepo: () => ({ findUserByEmail, findUserById, auditReport }),
}));

import { GET } from "@/app/api/audit/[userId]/route";

const ID = "6f1c2a3e-8b4d-4e5f-9a6b-1c2d3e4f5a6b";

const get = (query = "", id = ID) =>
  GET(new Request(`http://localhost/api/audit/${id}${query}`), {
    params: Promise.resolve({ userId: id }),
  });

const asHr = () => {
  getSession.mockResolvedValue({ role: "hr_admin", user: { email: "hana@example.com" } });
  findUserByEmail.mockResolvedValue({ id: "hr-1", managerId: null, role: "hr_admin" });
};

beforeEach(() => {
  for (const fn of [getSession, findUserByEmail, findUserById, auditReport]) fn.mockReset();
  findUserById.mockResolvedValue({ id: ID, name: "Ana Cruz", role: "employee" });
  auditReport.mockResolvedValue([
    {
      id: "r-1",
      leaveTypeName: "Vacation",
      startDate: "2026-11-02",
      endDate: "2026-11-04",
      status: "rejected",
      createdAt: "2026-10-10T08:00:00Z",
      decidedByName: "Maria Santos",
      decidedAt: "2026-10-16T01:00:00Z",
      decisionReason: "No cover",
    },
  ]);
});

describe("GET /api/audit/:userId", () => {
  it("401s without a session", async () => {
    getSession.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
    expect(auditReport).not.toHaveBeenCalled();
  });

  it("403s for an employee and a manager without touching the database", async () => {
    for (const role of ["employee", "manager"] as const) {
      getSession.mockResolvedValue({ role, user: { email: "x@example.com" } });
      const res = await get();
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
    }
    expect(findUserByEmail).not.toHaveBeenCalled();
    expect(auditReport).not.toHaveBeenCalled();
  });

  it("403s when the session says hr_admin but the database role is not", async () => {
    getSession.mockResolvedValue({ role: "hr_admin", user: { email: "maria@example.com" } });
    findUserByEmail.mockResolvedValue({ id: "m-1", managerId: null, role: "manager" });
    expect((await get()).status).toBe(403);
    expect(auditReport).not.toHaveBeenCalled();
  });

  it.each([
    ["?from=2026-13-01", "Enter a valid date."],
    ["?from=11/02/2026", "Dates must be in YYYY-MM-DD format."],
    ["?from=2026-12-31&to=2026-01-01", "The from date cannot be after the to date."],
  ])("400s for %s", async (query, message) => {
    asHr();
    const res = await get(query);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.message).toBe(message);
    expect(auditReport).not.toHaveBeenCalled();
  });

  it("404s a malformed id and an unknown employee", async () => {
    asHr();
    expect((await get("", "not-a-uuid")).status).toBe(404);
    expect(findUserById).not.toHaveBeenCalled();

    findUserById.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
    expect(auditReport).not.toHaveBeenCalled();
  });

  it("200s with the employee, filters and requests, and no employee free text", async () => {
    asHr();
    const res = await get("?from=2026-01-01&to=2026-12-31");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.employee).toEqual({ id: ID, name: "Ana Cruz" });
    expect(json.data.filters).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(json.data.requests[0]).toMatchObject({
      status: "rejected",
      decidedByName: "Maria Santos",
      decidedAt: "2026-10-16T01:00:00Z",
    });
    expect(Object.keys(json.data.requests[0])).not.toContain("reason");
    expect(auditReport).toHaveBeenCalledWith(ID, { from: "2026-01-01", to: "2026-12-31" });
  });

  it("treats empty from/to as not set", async () => {
    asHr();
    await get("?from=&to=");
    expect(auditReport).toHaveBeenCalledWith(ID, {});
  });

  it("returns a generic 500 when the database fails", async () => {
    asHr();
    auditReport.mockRejectedValue(new Error("rpc exploded with secret detail"));
    const res = await get();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
