"use client";

import { useLinkStatus } from "next/link";
import { IconChevronLeft, IconChevronRight, IconLoader2 } from "@tabler/icons-react";

/**
 * Must be rendered inside a <Link>. Shows the arrow, or a spinner while that link's navigation is
 * pending. Same size either way, so nothing shifts.
 */
export function LinkPendingIcon({ direction }: { direction: "prev" | "next" }) {
  const { pending } = useLinkStatus();
  if (pending) {
    return (
      <IconLoader2
        size={16}
        aria-hidden="true"
        className="animate-spin motion-reduce:animate-none"
      />
    );
  }
  const Icon = direction === "prev" ? IconChevronLeft : IconChevronRight;
  return <Icon size={16} aria-hidden="true" />;
}
