import "server-only";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
} from "@/lib/leave/notifications";
import { createLeaveRepo } from "@/lib/leave/repo";
import { logger } from "@/lib/logger";
import type { Session } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { NotificationView } from "@/types/domain";

/** For server pages: the signed-in user's notifications. Empty when no database is configured. */
export async function loadNotifications(session: Session): Promise<NotificationView[]> {
  if (!isSupabaseConfigured()) return [];
  return getNotifications(createLeaveRepo(), session.user.email);
}

/**
 * The nav badge. Fails soft: a problem here must never break the page around it, so any error becomes
 * "no badge" and is logged.
 */
export async function loadUnreadCount(session: Session): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    return await getUnreadCount(createLeaveRepo(), session.user.email);
  } catch (err) {
    logger.warn("unread notification count unavailable", { err: String(err) });
    return 0;
  }
}

export async function markAllRead(session: Session): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  return markAllNotificationsRead(createLeaveRepo(), session.user.email);
}
