import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { AuditTable } from "@/components/leave/audit-table";
import { Alert } from "@/components/ui/feedback";
import { loadAudit } from "@/lib/leave/audit-data";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Audit report" };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; from?: string; to?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  // proxy.ts already redirects other roles; this is defence in depth.
  if (session.role !== "hr_admin") redirect("/dashboard");

  const data = await loadAudit(session, await searchParams);

  return (
    <>
      <PageHeader
        title="Audit report"
        description="Full decision history for one employee, retained for at least 3 years."
      />
      {data.live ? null : (
        <div className="mb-4">
          <Alert tone="warning">No database configured: showing mock data.</Alert>
        </div>
      )}
      <AuditTable
        employees={data.employees}
        selected={data.selected}
        from={data.from}
        to={data.to}
        rows={data.rows}
        problem={data.problem}
      />
    </>
  );
}
