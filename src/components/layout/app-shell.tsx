import type { ReactNode } from "react";
import { IconLogout } from "@tabler/icons-react";
import { logoutAction } from "@/app/(auth)/actions";
import { NavLinks } from "@/components/layout/nav-links";
import { Button } from "@/components/ui/button";
import { navFor, ROLE_LABELS } from "@/lib/roles";
import type { Role } from "@/types/domain";

export interface AppShellProps {
  role: Role;
  userName: string;
  children: ReactNode;
}

/** Sidebar from md up, bottom tab bar below md (BR-05: mobile-first). */
export function AppShell({ role, userName, children }: AppShellProps) {
  const items = navFor(role);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-border bg-surface p-4 md:flex md:flex-col md:gap-6">
        <p className="px-3 text-lg font-semibold text-primary">LeaveTrack</p>
        <nav aria-label="Main">
          <NavLinks items={items} variant="sidebar" />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col pb-16 md:pb-0">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
          <p className="shrink-0 font-semibold text-primary md:hidden">LeaveTrack</p>
          {/* min-w-0 + truncate: a long name or a larger system text size shrinks this, instead of
              pushing "Sign out" off the screen. The tooltip carries the full text. */}
          <p
            className="ml-auto min-w-0 flex-1 truncate text-right text-sm text-muted"
            title={`${userName} · ${ROLE_LABELS[role]}`}
          >
            <span className="font-medium text-foreground">{userName}</span> · {ROLE_LABELS[role]}
          </p>
          <form action={logoutAction} className="shrink-0">
            <Button type="submit" variant="ghost" aria-label="Sign out">
              <IconLogout size={20} aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface md:hidden"
      >
        <NavLinks items={items} variant="bottom" />
      </nav>
    </div>
  );
}
