import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { AuditFilters } from "@/components/leave/audit-filters";
import { AuditTable } from "@/components/leave/audit-table";
import { Alert } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { homeFor } from "@/lib/roles";
import { auditHref } from "@/lib/leave/audit-query";
import { loadAudit } from "@/lib/leave/audit-data";
import { paginate } from "@/lib/paginate";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Audit report" };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; from?: string; to?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  // proxy.ts already redirects other roles; this is defence in depth.
  if (session.role !== "hr_admin") redirect(homeFor(session.role));

  const params = await searchParams;
  const data = await loadAudit(session, params);
  const { items, page, pageCount } = paginate(data.rows, params.page);
  const hrefFor = (n: number) =>
    auditHref({ userId: params.userId, from: data.from, to: data.to, page: n });

  return (
    <>
      <PageHeader title="Audit report" description="Decision history for one employee." />
      {data.live ? null : (
        <div className="mb-4">
          <Alert tone="warning">No database configured: showing mock data.</Alert>
        </div>
      )}
      <AuditFilters
        employees={data.employees}
        selectedId={data.selected?.id ?? ""}
        from={data.from}
        to={data.to}
      >
        <AuditTable
          selected={data.selected}
          rows={items}
          pager={
            data.rows.length > 0 ? (
              <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
            ) : null
          }
          problem={data.problem}
        />
      </AuditFilters>
    </>
  );
}
