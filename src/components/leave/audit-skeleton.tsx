import { Skeleton } from "@/components/ui/feedback";

/** Placeholder for the report area while it loads (cards on phones, a table block from lg). */
export function AuditResultsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <Skeleton className="h-6 w-40" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-lg lg:h-14" />
      ))}
    </div>
  );
}
