import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { loadUnreadCount } from "@/lib/leave/notifications-data";
import { getSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  // proxy.ts already redirects; this is defence in depth.
  if (!session) redirect("/login");

  // Only employees and managers receive notifications (HR has none, so no query). The count is NOT
  // awaited here: the page renders at once and the nav badge streams in when it is ready.
  const unread = session.role === "hr_admin" ? Promise.resolve(0) : loadUnreadCount(session);

  return (
    <AppShell role={session.role} userName={session.user.name} unreadNotifications={unread}>
      {children}
    </AppShell>
  );
}
