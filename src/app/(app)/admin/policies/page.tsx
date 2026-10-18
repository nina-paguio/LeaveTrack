import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PolicyTable, type PolicyRow } from "@/components/leave/policy-table";
import { Pagination } from "@/components/ui/pagination";
import { paginate } from "@/lib/paginate";
import { leaveTypeById, policies, userById } from "@/mocks/data";

export const metadata: Metadata = { title: "Leave policies" };

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const rows: PolicyRow[] = policies.map((p) => ({
    id: p.id,
    employeeName: userById(p.userId)?.name ?? "Unknown",
    leaveTypeName: leaveTypeById(p.leaveTypeId)?.name ?? "Unknown",
    accrualPerMonth: p.accrualPerMonth,
  }));
  const { items, page, pageCount } = paginate(rows, (await searchParams).page);

  return (
    <>
      <PageHeader
        title="Leave policies"
        description="Accrual per month by employee and leave type. Editing arrives in Day 1."
      />
      <PolicyTable rows={items} />
      {rows.length > 0 ? (
        <Pagination
          page={page}
          pageCount={pageCount}
          hrefFor={(n) => `/admin/policies?page=${n}`}
        />
      ) : null}
    </>
  );
}
