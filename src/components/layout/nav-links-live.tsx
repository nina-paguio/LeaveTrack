"use client";

import { Suspense, use } from "react";
import { NavLinks, type NavLinksProps } from "@/components/layout/nav-links";

function WithBadge({ items, variant, unread }: NavLinksProps & { unread: Promise<number> }) {
  const count = use(unread);
  const withBadge = items.map((item) =>
    item.icon === "notifications" && count > 0 ? { ...item, badge: count } : item,
  );
  return <NavLinks items={withBadge} variant={variant} />;
}

/**
 * The nav, with the unread-notifications badge filled in when the count arrives. The page does not
 * wait for it: until then the nav shows without a badge. `unread` must never reject (see
 * loadUnreadCount, which fails soft).
 */
export function NavLinksLive({
  items,
  variant,
  unread,
}: NavLinksProps & { unread: Promise<number> }) {
  return (
    <Suspense fallback={<NavLinks items={items} variant={variant} />}>
      <WithBadge items={items} variant={variant} unread={unread} />
    </Suspense>
  );
}
