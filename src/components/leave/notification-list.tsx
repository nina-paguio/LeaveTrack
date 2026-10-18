import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/leave/format";
import { describeNotification } from "@/lib/leave/notifications";
import type { NotificationView } from "@/types/domain";

/** The notifications on one page. Unread items say "New" in text and are bold, never color alone. */
export function NotificationList({ items }: { items: NotificationView[] }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Notifications">
      {items.map((n) => {
        const { text, detail, href } = describeNotification(n);
        const isUnread = !n.readAt;
        return (
          <li key={n.id} className="rounded-lg border border-border bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <p className={cn("min-w-0 [overflow-wrap:anywhere]", isUnread && "font-semibold")}>
                {text}
              </p>
              {isUnread ? (
                <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                  New
                </span>
              ) : null}
            </div>
            {detail ? (
              <p className="mt-1 text-sm text-muted [overflow-wrap:anywhere]">{detail}</p>
            ) : null}
            <div className="mt-2 flex items-center justify-between gap-3 text-sm text-muted">
              <time dateTime={n.createdAt}>{formatDateTime(n.createdAt)}</time>
              <Link
                href={href}
                className="inline-flex min-h-11 min-w-11 items-center justify-end font-medium text-primary hover:underline"
              >
                View
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
