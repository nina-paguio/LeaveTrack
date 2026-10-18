import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  // proxy.ts already redirects; this is defence in depth.
  if (!session) redirect("/login");

  return (
    <AppShell role={session.role} userName={session.user.name}>
      {children}
    </AppShell>
  );
}
