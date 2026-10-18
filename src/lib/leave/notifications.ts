import { AppError } from "@/lib/errors";
import { formatDateRange } from "@/lib/leave/format";
import type { RepoUser } from "@/lib/leave/submit";
import type { NotificationView } from "@/types/domain";

/**
 * In-app notifications (US-01 AC1: the manager is told of a submission; US-03: the employee is told of
 * a decision). The rows are written by submit_leave_request / decide_leave_request in the same
 * transaction as the request; this layer only reads and marks them. Every method takes ONE user id,
 * resolved from the session's email, and the SQL filters on it: a query parameter never chooses whose
 * notifications are read.
 */
export interface NotificationRepo {
  findUserByEmail(email: string): Promise<RepoUser | null>;
  /** The user's own notifications, newest first (at most 200; see migration 0007). */
  listNotifications(userId: string): Promise<NotificationView[]>;
  countUnread(userId: string): Promise<number>;
  /** Marks only this user's unread notifications read. Returns how many changed. */
  markAllRead(userId: string): Promise<number>;
}

async function requireUser(repo: Pick<NotificationRepo, "findUserByEmail">, email: string) {
  const user = await repo.findUserByEmail(email);
  if (!user) throw new AppError("NOT_FOUND", "Your user profile was not found.", 404);
  return user;
}

export async function getNotifications(
  repo: NotificationRepo,
  email: string,
): Promise<NotificationView[]> {
  const user = await requireUser(repo, email);
  return repo.listNotifications(user.id);
}

export async function getUnreadCount(repo: NotificationRepo, email: string): Promise<number> {
  const user = await requireUser(repo, email);
  return repo.countUnread(user.id);
}

export async function markAllNotificationsRead(
  repo: NotificationRepo,
  email: string,
): Promise<number> {
  const user = await requireUser(repo, email);
  return repo.markAllRead(user.id);
}

export interface NotificationText {
  /** The one-line message. */
  text: string;
  /** Extra line, e.g. the manager's reason for a rejection. */
  detail?: string;
  /** Where "View" goes: the manager's queue, or the employee's own leave page. */
  href: string;
}

/**
 * The wording lives here (not in the database) so it can change without a migration. It uses names,
 * leave type and dates only; the employee's own free-text reason is never part of a notification.
 */
export function describeNotification(n: NotificationView): NotificationText {
  const dates = formatDateRange(n.startDate, n.endDate);
  const type = n.leaveTypeName;
  switch (n.kind) {
    case "request_submitted":
      return {
        text: `${n.employeeName} requested ${type} leave, ${dates}.`,
        href: "/team/requests",
      };
    case "request_approved":
      return {
        text: `${n.decidedByName ?? "Your manager"} approved your ${type} request, ${dates}.`,
        href: "/leave/balance",
      };
    case "request_rejected":
      return {
        text: `${n.decidedByName ?? "Your manager"} rejected your ${type} request, ${dates}.`,
        detail: n.decisionReason ? `Reason: ${n.decisionReason}` : undefined,
        href: "/leave/balance",
      };
  }
}
