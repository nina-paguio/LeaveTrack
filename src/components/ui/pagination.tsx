import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { LinkPendingIcon } from "@/components/ui/link-pending-icon";
import { cn } from "@/lib/cn";

export interface PaginationProps {
  page: number;
  pageCount: number;
  /** Builds the link for a page number, e.g. (n) => `/team/requests?page=${n}`. */
  hrefFor: (page: number) => string;
}

// Compact for a mouse; 44px on touch screens (the app-wide tap-target rule).
const BOX =
  "inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface pointer-coarse:size-11";

function Arrow({
  direction,
  to,
}: {
  direction: "prev" | "next";
  /** The link target, or null when there is no such page (the arrow is shown but disabled). */
  to: string | null;
}) {
  const Icon = direction === "prev" ? IconChevronLeft : IconChevronRight;
  const label = direction === "prev" ? "Previous page" : "Next page";
  if (!to) {
    return (
      <button type="button" disabled aria-label={label} className={cn(BOX, "opacity-40")}>
        <Icon size={16} aria-hidden="true" />
      </button>
    );
  }
  return (
    <Link href={to} rel={direction} aria-label={label} className={cn(BOX, "hover:bg-primary-soft")}>
      <LinkPendingIcon direction={direction} />
    </Link>
  );
}

/**
 * Under a table: "Page 1/3" on the left, the previous/next arrows on the right. Shown for any table
 * that has rows; with one page both arrows are disabled.
 */
export function Pagination({ page, pageCount, hrefFor }: PaginationProps) {
  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center justify-between gap-3">
      <p className="text-sm text-muted">
        Page {page}/{pageCount}
      </p>
      <div className="flex items-center gap-1.5">
        <Arrow direction="prev" to={page > 1 ? hrefFor(page - 1) : null} />
        <Arrow direction="next" to={page < pageCount ? hrefFor(page + 1) : null} />
      </div>
    </nav>
  );
}
