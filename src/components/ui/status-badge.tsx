import { IconCheck, IconClock, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import type { RequestStatus } from "@/types/domain";

const STYLES: Record<RequestStatus, { label: string; className: string; Icon: typeof IconClock }> =
  {
    pending: { label: "Pending", className: "bg-warning-soft text-warning", Icon: IconClock },
    approved: { label: "Approved", className: "bg-success-soft text-success", Icon: IconCheck },
    rejected: { label: "Rejected", className: "bg-error-soft text-error", Icon: IconX },
  };

/** Status is conveyed by icon + text, never color alone. */
export function StatusBadge({ status }: { status: RequestStatus }) {
  const { label, className, Icon } = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}
