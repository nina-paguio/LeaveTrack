import { describe, expect, it, vi } from "vitest";
import {
  describeNotification,
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  type NotificationRepo,
} from "@/lib/leave/notifications";
import type { NotificationView } from "@/types/domain";

const base: NotificationView = {
  id: "n-1",
  kind: "request_submitted",
  createdAt: "2026-10-19T01:00:00Z",
  readAt: null,
  requestId: "r-1",
  employeeName: "Ana Cruz",
  leaveTypeName: "Vacation",
  startDate: "2026-10-09",
  endDate: "2026-10-14",
  decidedByName: null,
  decisionReason: null,
};

function fakeRepo(over: Partial<NotificationRepo> = {}) {
  const repo = {
    findUserByEmail: vi.fn(async () => ({
      id: "user-1",
      managerId: null,
      role: "manager" as const,
    })),
    listNotifications: vi.fn(async () => [base]),
    countUnread: vi.fn(async () => 3),
    markAllRead: vi.fn(async () => 2),
    ...over,
  };
  return repo;
}

describe("notification service", () => {
  it("reads, counts and marks only the session user's id (resolved from their email)", async () => {
    const repo = fakeRepo();
    expect(await getNotifications(repo, "maria@example.com")).toEqual([base]);
    expect(await getUnreadCount(repo, "maria@example.com")).toBe(3);
    expect(await markAllNotificationsRead(repo, "maria@example.com")).toBe(2);
    expect(repo.findUserByEmail).toHaveBeenCalledWith("maria@example.com");
    expect(repo.listNotifications).toHaveBeenCalledWith("user-1");
    expect(repo.countUnread).toHaveBeenCalledWith("user-1");
    expect(repo.markAllRead).toHaveBeenCalledWith("user-1");
  });

  it("404s an unknown user and never touches the notification tables", async () => {
    const repo = fakeRepo({ findUserByEmail: vi.fn(async () => null) });
    for (const call of [getNotifications, getUnreadCount, markAllNotificationsRead]) {
      await expect(call(repo, "ghost@example.com")).rejects.toMatchObject({ status: 404 });
    }
    expect(repo.listNotifications).not.toHaveBeenCalled();
    expect(repo.countUnread).not.toHaveBeenCalled();
    expect(repo.markAllRead).not.toHaveBeenCalled();
  });
});

describe("describeNotification", () => {
  it("tells the manager who asked for what, and links to the approvals queue", () => {
    expect(describeNotification(base)).toEqual({
      text: "Ana Cruz requested Vacation leave, Oct 9–14, 2026.",
      href: "/team/requests",
    });
  });

  it("tells the employee who approved, and links to their leave page", () => {
    const n = { ...base, kind: "request_approved" as const, decidedByName: "Maria Santos" };
    expect(describeNotification(n)).toEqual({
      text: "Maria Santos approved your Vacation request, Oct 9–14, 2026.",
      href: "/leave/balance",
    });
  });

  it("includes the manager's reason on a rejection, never the employee's own", () => {
    const n = {
      ...base,
      kind: "request_rejected" as const,
      decidedByName: "Maria Santos",
      decisionReason: "No cover that week",
    };
    const d = describeNotification(n);
    expect(d.text).toBe("Maria Santos rejected your Vacation request, Oct 9–14, 2026.");
    expect(d.detail).toBe("Reason: No cover that week");
    // the view type has no field for the employee's reason, so it cannot leak into the text
    expect(JSON.stringify(d)).not.toContain("verify");
  });

  it("falls back to 'Your manager' when the decider is unknown and omits an empty reason", () => {
    const d = describeNotification({ ...base, kind: "request_rejected" });
    expect(d.text.startsWith("Your manager rejected")).toBe(true);
    expect(d.detail).toBeUndefined();
  });
});
