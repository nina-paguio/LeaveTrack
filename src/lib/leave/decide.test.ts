import { describe, expect, it, vi } from "vitest";
import {
  decideLeaveRequest,
  type DecideOutcome,
  type DecideRepo,
  type DecisionRefusal,
} from "@/lib/leave/decide";
import type { Role } from "@/types/domain";

const REQUEST_ID = "6f1c2a3e-8b4d-4e5f-9a6b-1c2d3e4f5a6b";

const decided: DecideOutcome = {
  ok: true,
  request: {
    id: REQUEST_ID,
    status: "approved",
    decidedBy: "mgr-1",
    decidedAt: "2026-10-16T00:00:00Z",
    decisionReason: null,
  },
};

function fakeRepo(role: Role = "manager", outcome: DecideOutcome = decided) {
  return {
    findUserByEmail: vi.fn(async () => ({ id: "mgr-1", managerId: null, role })),
    decideRequest: vi.fn(async () => outcome),
  } satisfies DecideRepo;
}

describe("decideLeaveRequest", () => {
  it("passes the resolved manager's id, the request id and the input to the repo", async () => {
    const repo = fakeRepo();
    const result = await decideLeaveRequest(repo, "maria@example.com", REQUEST_ID, {
      decision: "approve",
    });
    expect(repo.decideRequest).toHaveBeenCalledTimes(1);
    expect(repo.decideRequest).toHaveBeenCalledWith("mgr-1", REQUEST_ID, { decision: "approve" });
    expect(result.status).toBe("approved");
  });

  it("forwards a rejection reason", async () => {
    const repo = fakeRepo("manager", {
      ok: true,
      request: {
        id: REQUEST_ID,
        status: "rejected",
        decidedBy: "mgr-1",
        decidedAt: "2026-10-16T00:00:00Z",
        decisionReason: "No cover",
      },
    });
    await decideLeaveRequest(repo, "maria@example.com", REQUEST_ID, {
      decision: "reject",
      reason: "No cover",
    });
    expect(repo.decideRequest).toHaveBeenCalledWith("mgr-1", REQUEST_ID, {
      decision: "reject",
      reason: "No cover",
    });
  });

  it.each([
    ["NOT_FOUND", 404, "NOT_FOUND"],
    ["FORBIDDEN", 403, "FORBIDDEN"],
    ["NOT_PENDING", 409, "CONFLICT"],
    ["REASON_REQUIRED", 400, "VALIDATION_ERROR"],
    ["INVALID_DECISION", 400, "VALIDATION_ERROR"],
  ] as [DecisionRefusal, number, string][])(
    "maps the database refusal %s to HTTP %i (%s)",
    async (refusal, status, code) => {
      const repo = fakeRepo("manager", { ok: false, refusal });
      await expect(
        decideLeaveRequest(repo, "maria@example.com", REQUEST_ID, { decision: "approve" }),
      ).rejects.toMatchObject({ status, code });
    },
  );

  it("403s unless the DATABASE role is manager, and never calls the repo", async () => {
    for (const role of ["employee", "hr_admin"] as const) {
      const repo = fakeRepo(role);
      await expect(
        decideLeaveRequest(repo, "x@example.com", REQUEST_ID, { decision: "approve" }),
      ).rejects.toMatchObject({ status: 403 });
      expect(repo.decideRequest).not.toHaveBeenCalled();
    }
  });

  it("404s a malformed id without asking the database, after the manager check", async () => {
    const repo = fakeRepo();
    for (const id of ["not-a-uuid", "", "1", "' or 1=1 --"]) {
      await expect(
        decideLeaveRequest(repo, "maria@example.com", id, { decision: "approve" }),
      ).rejects.toMatchObject({ status: 404 });
    }
    expect(repo.decideRequest).not.toHaveBeenCalled();

    const employee = fakeRepo("employee");
    await expect(
      decideLeaveRequest(employee, "x@example.com", "not-a-uuid", { decision: "approve" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("404s an unknown user and decides nothing", async () => {
    const repo = fakeRepo();
    repo.findUserByEmail.mockResolvedValueOnce(null as never);
    await expect(
      decideLeaveRequest(repo, "nobody@example.com", REQUEST_ID, { decision: "approve" }),
    ).rejects.toMatchObject({ status: 404 });
    expect(repo.decideRequest).not.toHaveBeenCalled();
  });
});
