import { PageHeader } from "@/components/layout/page-header";
import { AuditResultsSkeleton } from "@/components/leave/audit-skeleton";
import { Skeleton } from "@/components/ui/feedback";
import { ProgressBar } from "@/components/ui/progress-bar";

/** Shown at once while the audit page loads its first data (employees, then the report). */
export default function AuditLoading() {
  return (
    <>
      <PageHeader title="Audit report" description="Decision history for one employee." />
      <div role="status" aria-live="polite" className="sr-only">
        Loading audit report…
      </div>
      <div className="flex flex-col gap-4">
        <div aria-hidden="true" className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:items-end">
          <Skeleton className="col-span-2 h-[4.5rem] sm:col-span-1" />
          <Skeleton className="h-[4.5rem]" />
          <Skeleton className="h-[4.5rem]" />
          <Skeleton className="col-span-2 h-11 sm:col-span-1" />
        </div>
        <ProgressBar label="Loading audit report" />
        <AuditResultsSkeleton />
      </div>
    </>
  );
}
