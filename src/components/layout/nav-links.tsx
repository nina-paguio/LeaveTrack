"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBell,
  IconCalendarPlus,
  IconChecklist,
  IconClipboardCheck,
  IconScale,
  IconSettings,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/roles";

const ICONS: Record<NavItem["icon"], typeof IconScale> = {
  new: IconCalendarPlus,
  balance: IconScale,
  team: IconChecklist,
  audit: IconClipboardCheck,
  policies: IconSettings,
  notifications: IconBell,
};

/** A number, never color alone, plus a spoken form for screen readers. */
function Badge({ count, floating = false }: { count: number; floating?: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold leading-5 text-white",
          floating ? "absolute -right-2.5 -top-1.5" : "ml-auto",
        )}
      >
        {count > 99 ? "99+" : count}
      </span>
      <span className="sr-only">, {count} unread</span>
    </>
  );
}

export interface NavLinksProps {
  items: NavItem[];
  variant: "sidebar" | "bottom";
}

export function NavLinks({ items, variant }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <ul className={cn(variant === "sidebar" ? "flex flex-col gap-1" : "flex justify-around")}>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href} className={variant === "bottom" ? "min-w-0 flex-1" : undefined}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center rounded-md text-sm font-medium",
                variant === "sidebar"
                  ? "min-h-11 gap-3 px-3"
                  : // min-w-0 + anywhere-wrapping: with a larger system text size a label breaks
                    // inside the cell instead of making the bar wider than the screen.
                    "min-h-14 min-w-0 flex-col justify-center gap-0.5 px-1 text-center text-xs leading-tight [overflow-wrap:anywhere]",
                active ? "bg-primary-soft text-primary" : "text-muted hover:bg-primary-soft",
              )}
            >
              <span className="relative inline-flex">
                <Icon size={variant === "sidebar" ? 20 : 24} aria-hidden="true" />
                {item.badge && variant === "bottom" ? <Badge count={item.badge} floating /> : null}
              </span>
              {item.label}
              {item.badge && variant === "sidebar" ? <Badge count={item.badge} /> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
