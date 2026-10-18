import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/feedback";

export interface PolicyRow {
  id: string;
  employeeName: string;
  leaveTypeName: string;
  accrualPerMonth: number;
}

/** Read-only: the docs define no policy editing story (PRD US-07 only covers accrual). */
export function PolicyTable({ rows }: { rows: PolicyRow[] }) {
  const columns: Column<PolicyRow>[] = [
    { key: "employee", header: "Employee", card: "title", render: (r) => r.employeeName },
    { key: "type", header: "Leave type", card: "line", render: (r) => r.leaveTypeName },
    {
      key: "accrual",
      header: "Accrual / month (days)",
      render: (r) => r.accrualPerMonth,
    },
  ];

  return (
    <DataTable
      caption="Leave policies"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      empty={<EmptyState title="No policies configured" />}
    />
  );
}
