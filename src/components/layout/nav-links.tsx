"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconCalendarPlus,
  IconChecklist,
  IconClipboardCheck,
  IconLayoutDashboard,
  IconListDetails,
  IconScale,
  IconSettings,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/roles";

const ICONS: Record<NavItem["icon"], typeof IconScale> = {
  dashboard: IconLayoutDashboard,
  new: IconCalendarPlus,
  balance: IconScale,
  requests: IconListDetails,
  team: IconChecklist,
  audit: IconClipboardCheck,
  policies: IconSettings,
};

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
              <Icon size={variant === "sidebar" ? 20 : 24} aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
