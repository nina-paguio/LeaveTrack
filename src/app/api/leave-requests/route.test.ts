import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const createRequest = vi.fn();

vi.mock("@/lib/session", () => ({ getSession: () => getSession() }));
// Replaces the server-only Supabase repo, so no database is touched.
vi.mock("@/lib/leave/repo", () => ({
  createLeaveRepo: () => ({
    findUserByEmail: async () => ({ id: "user-1", managerId: "mgr-1", role: "employee" as const }),
    findLeaveType: async () => ({ id: "lt-vac", name: "Vacation", tracksBalance: true }),
    getBalance: async () => 12.5,
    createRequest,
  }),
}));

import { POST } from "@/app/api/leave-requests/route";

const body = {
  leaveTypeId: "6f1c2a3e-8b4d-4e5f-9a6b-1c2d3e4f5a6b",
  startDate: "2026-11-02",
  endDate: "2026-11-04",
  reason: "Family trip",
};

const post = (payload: unknown) =>
  POST(
    new Request("http://localhost/api/leave-requests", {
      method: "POST",
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    }),
  );

beforeEach(() => {
  getSession.mockReset();
  createRequest.mockReset();
  createRequest.mockResolvedValue({
    id: "req-1",
    status: "pending",
    leaveTypeId: body.leaveTypeId,
    startDate: body.startDate,
    endDate: body.endDate,
    reason: body.reason,
    createdAt: "2026-10-16T00:00:00Z",
  });
});

describe("POST /api/leave-requests", () => {
  it("401s without a session", async () => {
    getSession.mockResolvedValue(null);
    const res = await post(body);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
    expect(createRequest).not.toHaveBeenCalled();
  });

  it("403s for an HR admin and for a manager (submitting is the Employee role's)", async () => {
    for (const role of ["hr_admin", "manager"] as const) {
      getSession.mockResolvedValue({ role, user: { email: "x@example.com" } });
      const res = await post(body);
      expect(res.status).toBe(403);
    }
    expect(createRequest).not.toHaveBeenCalled();
  });

  it("AC2: 400s on an end date before the start date and creates nothing", async () => {
    getSession.mockResolvedValue({ role: "employee", user: { email: "ana@example.com" } });
    const res = await post({ ...body, startDate: "2026-11-05", endDate: "2026-11-04" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "End date cannot be before the start date." },
    });
    expect(createRequest).not.toHaveBeenCalled();
  });

  it("400s on a body that is not JSON", async () => {
    getSession.mockResolvedValue({ role: "employee", user: { email: "ana@example.com" } });
    const res = await post("not json");
    expect(res.status).toBe(400);
    expect(createRequest).not.toHaveBeenCalled();
  });

  it("AC1: 201s with the pending request for an employee", async () => {
    getSession.mockResolvedValue({ role: "employee", user: { email: "ana@example.com" } });
    const res = await post(body);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.request.status).toBe("pending");
    expect(createRequest).toHaveBeenCalledTimes(1);
  });
});
