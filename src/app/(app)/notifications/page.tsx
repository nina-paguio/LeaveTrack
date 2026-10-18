import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { NotificationList } from "@/components/leave/notification-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { loadNotifications } from "@/lib/leave/notifications-data";
import { paginate } from "@/lib/paginate";
import { getSession } from "@/lib/session";
import { markAllReadAction } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const all = await loadNotifications(session);
  const unread = all.filter((n) => !n.readAt).length;
  const { items, page, pageCount } = paginate(all, (await searchParams).page);
  const isManager = session.role === "manager";

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : "You're all caught up."}
        action={
          unread > 0 ? (
            <form action={markAllReadAction}>
              <Button type="submit" variant="secondary">
                Mark all as read
              </Button>
            </form>
          ) : null
        }
      />
      {all.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description={
            isManager
              ? "You'll be notified here when someone on your team submits a leave request."
              : "You'll be notified here when your manager approves or rejects a request."
          }
        />
      ) : (
        <>
          <NotificationList items={items} />
          <Pagination
            page={page}
            pageCount={pageCount}
            hrefFor={(n) => `/notifications?page=${n}`}
          />
        </>
      )}
    </>
  );
}
