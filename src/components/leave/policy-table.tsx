import { Input } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/feedback";

export interface PolicyRow {
  id: string;
  employeeName: string;
  leaveTypeName: string;
  accrualPerMonth: number;
}

/** Read-only in Day 0: editing and saving policies is wired in Day 1. */
export function PolicyTable({ rows }: { rows: PolicyRow[] }) {
  const columns: Column<PolicyRow>[] = [
    { key: "employee", header: "Employee", render: (r) => r.employeeName },
    { key: "type", header: "Leave type", render: (r) => r.leaveTypeName },
    {
      key: "accrual",
      header: "Accrual / month (days)",
      render: (r) => (
        <Input
          type="number"
          aria-label={`Accrual per month for ${r.employeeName}, ${r.leaveTypeName}`}
          defaultValue={r.accrualPerMonth}
          disabled
          className="w-28"
        />
      ),
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
