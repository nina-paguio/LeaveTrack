import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import {
  submitLeaveRequest,
  type CreatedRequest,
  type LeaveRepo,
  type RepoLeaveType,
} from "@/lib/leave/submit";
import type { SubmitLeaveRequestInput } from "@/lib/leave/validate";

const VACATION: RepoLeaveType = { id: "lt-vac", name: "Vacation", tracksBalance: true };
const UNPAID: RepoLeaveType = { id: "lt-unpaid", name: "Unpaid", tracksBalance: false };

const input = (over: Partial<SubmitLeaveRequestInput> = {}): SubmitLeaveRequestInput => ({
  leaveTypeId: VACATION.id,
  startDate: "2026-11-02",
  endDate: "2026-11-04",
  reason: "Family trip",
  ...over,
});

function fakeRepo(
  over: Partial<LeaveRepo> & { type?: RepoLeaveType; balance?: number | null } = {},
) {
  const created: CreatedRequest = {
    id: "req-1",
    status: "pending",
    leaveTypeId: over.type?.id ?? VACATION.id,
    startDate: "2026-11-02",
    endDate: "2026-11-04",
    reason: "Family trip",
    createdAt: "2026-10-16T00:00:00Z",
  };
  const repo = {
    findUserByEmail: vi.fn(async () => ({
      id: "user-1",
      managerId: "mgr-1",
      role: "employee" as const,
    })),
    findLeaveType: vi.fn(async () => over.type ?? VACATION),
    getBalance: vi.fn(async () => (over.balance === undefined ? 12.5 : over.balance)),
    createRequest: vi.fn(async () => created),
    ...over,
  } satisfies LeaveRepo;
  return repo;
}

describe("submitLeaveRequest", () => {
  it("AC1: creates exactly one pending request and returns it", async () => {
    const repo = fakeRepo();
    const result = await submitLeaveRequest(repo, "ana@example.com", input());
    expect(repo.createRequest).toHaveBeenCalledTimes(1);
    expect(repo.createRequest).toHaveBeenCalledWith("user-1", input());
    expect(result.request.status).toBe("pending");
    expect(result.warning).toBeNull();
  });

  it("AC3: warns when over balance but still creates the request", async () => {
    const repo = fakeRepo({ balance: 2 });
    const result = await submitLeaveRequest(repo, "ana@example.com", input());
    expect(repo.createRequest).toHaveBeenCalledTimes(1);
    expect(result.warning).toMatchObject({ code: "OVER_BALANCE", requestedDays: 3, balance: 2 });
  });

  it("treats a missing balance row as 0", async () => {
    const result = await submitLeaveRequest(
      fakeRepo({ balance: null }),
      "ana@example.com",
      input(),
    );
    expect(result.warning).toMatchObject({ balance: 0 });
  });

  it("does not warn when the request equals the balance", async () => {
    const result = await submitLeaveRequest(fakeRepo({ balance: 3 }), "ana@example.com", input());
    expect(result.warning).toBeNull();
  });

  it("US-08 AC2: Unpaid is never checked or warned", async () => {
    const repo = fakeRepo({ type: UNPAID, balance: 0 });
    const result = await submitLeaveRequest(
      repo,
      "ana@example.com",
      input({ leaveTypeId: UNPAID.id }),
    );
    expect(repo.getBalance).not.toHaveBeenCalled();
    expect(result.warning).toBeNull();
    expect(repo.createRequest).toHaveBeenCalledTimes(1);
  });

  it("404s and writes nothing for an unknown user or leave type", async () => {
    const noUser = fakeRepo({ findUserByEmail: vi.fn(async () => null) });
    await expect(submitLeaveRequest(noUser, "x@example.com", input())).rejects.toMatchObject({
      status: 404,
    });
    expect(noUser.createRequest).not.toHaveBeenCalled();

    const noType = fakeRepo({ findLeaveType: vi.fn(async () => null) });
    await expect(submitLeaveRequest(noType, "ana@example.com", input())).rejects.toBeInstanceOf(
      AppError,
    );
    expect(noType.createRequest).not.toHaveBeenCalled();
  });
});
