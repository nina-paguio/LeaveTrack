import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findUserByEmail = vi.fn();
const decideRequest = vi.fn();

vi.mock("@/lib/session", () => ({ getSession: () => getSession() }));
// Replaces the server-only Supabase repo, so no database is touched.
vi.mock("@/lib/leave/repo", () => ({
  createLeaveRepo: () => ({ findUserByEmail, decideRequest }),
}));

import { POST } from "@/app/api/leave-requests/[id]/decision/route";

const ID = "6f1c2a3e-8b4d-4e5f-9a6b-1c2d3e4f5a6b";

const post = (body: unknown, id = ID) =>
  POST(
    new Request(`http://localhost/api/leave-requests/${id}/decision`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

const asManager = () => {
  getSession.mockResolvedValue({ role: "manager", user: { email: "maria@example.com" } });
  findUserByEmail.mockResolvedValue({ id: "mgr-1", managerId: null, role: "manager" });
};

beforeEach(() => {
  for (const fn of [getSession, findUserByEmail, decideRequest]) fn.mockReset();
  decideRequest.mockResolvedValue({
    ok: true,
    request: {
      id: ID,
      status: "approved",
      decidedBy: "mgr-1",
      decidedAt: "2026-10-16T00:00:00Z",
      decisionReason: null,
    },
  });
});

describe("POST /api/leave-requests/:id/decision", () => {
  it("401s without a session", async () => {
    getSession.mockResolvedValue(null);
    expect((await post({ decision: "approve" })).status).toBe(401);
    expect(decideRequest).not.toHaveBeenCalled();
  });

  it("403s for an employee and an HR admin without touching the database", async () => {
    for (const role of ["employee", "hr_admin"] as const) {
      getSession.mockResolvedValue({ role, user: { email: "x@example.com" } });
      const res = await post({ decision: "approve" });
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
    }
    expect(findUserByEmail).not.toHaveBeenCalled();
    expect(decideRequest).not.toHaveBeenCalled();
  });

  it("403s when the session says manager but the database role is not", async () => {
    getSession.mockResolvedValue({ role: "manager", user: { email: "ana@example.com" } });
    findUserByEmail.mockResolvedValue({ id: "emp-9", managerId: null, role: "employee" });
    expect((await post({ decision: "approve" })).status).toBe(403);
    expect(decideRequest).not.toHaveBeenCalled();
  });

  it.each([
    ["not json", "Request body must be valid JSON."],
    [{}, null],
    [{ decision: "maybe" }, "Decision must be approve or reject."],
    [{ decision: "reject" }, "A reason is required to reject."],
    [{ decision: "reject", reason: "   " }, "A reason is required to reject."],
  ])("400s for body %j and decides nothing", async (body, message) => {
    asManager();
    const res = await post(body as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    if (message) expect(json.error.message).toBe(message);
    expect(decideRequest).not.toHaveBeenCalled();
  });

  it("404s a malformed id without asking the database", async () => {
    asManager();
    expect((await post({ decision: "approve" }, "not-a-uuid")).status).toBe(404);
    expect(decideRequest).not.toHaveBeenCalled();
  });

  it("200s on approve and passes the session manager's id, not anything from the request", async () => {
    asManager();
    const res = await post({ decision: "approve", managerId: "attacker", userId: "attacker" });
    expect(res.status).toBe(200);
    expect((await res.json()).data.request.status).toBe("approved");
    expect(decideRequest).toHaveBeenCalledTimes(1);
    expect(decideRequest).toHaveBeenCalledWith("mgr-1", ID, { decision: "approve" });
  });

  it("200s on reject with a reason", async () => {
    asManager();
    const res = await post({ decision: "reject", reason: "No cover that week" });
    expect(res.status).toBe(200);
    expect(decideRequest).toHaveBeenCalledWith("mgr-1", ID, {
      decision: "reject",
      reason: "No cover that week",
    });
  });

  it.each([
    ["NOT_FOUND", 404, "NOT_FOUND"],
    ["FORBIDDEN", 403, "FORBIDDEN"],
    ["NOT_PENDING", 409, "CONFLICT"],
  ])("maps the database refusal %s to %i %s", async (refusal, status, code) => {
    asManager();
    decideRequest.mockResolvedValue({ ok: false, refusal });
    const res = await post({ decision: "approve" });
    expect(res.status).toBe(status);
    expect((await res.json()).error.code).toBe(code);
  });

  it("returns a generic 500 when the database fails", async () => {
    asManager();
    decideRequest.mockRejectedValue(new Error("rpc exploded with secret detail"));
    const res = await post({ decision: "approve" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
