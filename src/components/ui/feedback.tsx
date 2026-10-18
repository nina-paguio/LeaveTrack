import type { ReactNode } from "react";
import { IconInbox, IconShieldLock } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-border motion-reduce:animate-none", className)}
    />
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** `forbidden` is the 403 state (e.g. a request that is not a direct report's). */
  variant?: "empty" | "forbidden";
  action?: ReactNode;
}

export function EmptyState({ title, description, variant = "empty", action }: EmptyStateProps) {
  const Icon = variant === "forbidden" ? IconShieldLock : IconInbox;
  return (
    <div
      role={variant === "forbidden" ? "alert" : undefined}
      className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center"
    >
      <Icon size={32} className="text-muted" aria-hidden="true" />
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

export function Alert({
  tone,
  children,
}: {
  tone: "warning" | "info" | "error";
  children: ReactNode;
}) {
  const styles = {
    warning: "border-warning bg-warning-soft text-warning",
    info: "border-primary bg-primary-soft text-foreground",
    error: "border-error bg-error-soft text-error",
  } as const;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-md border p-3 text-sm", styles[tone])}
    >
      {children}
    </div>
  );
}
