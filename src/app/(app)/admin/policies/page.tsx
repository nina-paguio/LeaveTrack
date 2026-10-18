import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PolicyTable, type PolicyRow } from "@/components/leave/policy-table";
import { leaveTypeById, policies, userById } from "@/mocks/data";

export const metadata: Metadata = { title: "Leave policies" };

export default function PoliciesPage() {
  const rows: PolicyRow[] = policies.map((p) => ({
    id: p.id,
    employeeName: userById(p.userId)?.name ?? "Unknown",
    leaveTypeName: leaveTypeById(p.leaveTypeId)?.name ?? "Unknown",
    accrualPerMonth: p.accrualPerMonth,
  }));

  return (
    <>
      <PageHeader
        title="Leave policies"
        description="Accrual per month by employee and leave type. Editing arrives in Day 1."
      />
      <PolicyTable rows={rows} />
    </>
  );
}
