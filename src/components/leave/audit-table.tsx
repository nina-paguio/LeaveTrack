import { Button } from "@/components/ui/button";
import { DateField, Select } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { FormField } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AuditEntry } from "@/lib/leave/audit";

export interface AuditTableProps {
  employees: { id: string; name: string }[];
  /** The employee the report was run for, or null before one is chosen. */
  selected: { id: string; name: string } | null;
  from: string;
  to: string;
  rows: AuditEntry[];
  /** A message to show instead of a report (bad input, unknown employee). */
  problem: string | null;
}

/**
 * Server-driven: the form is a plain GET, so the report is always one employee's history read
 * through GET /api/audit/:userId's service, never filtered in the browser.
 */
export function AuditTable({ employees, selected, from, to, rows, problem }: AuditTableProps) {
  const columns: Column<AuditEntry>[] = [
    { key: "type", header: "Type", render: (r) => r.leaveTypeName },
    { key: "dates", header: "Leave dates", render: (r) => `${r.startDate} to ${r.endDate}` },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "by", header: "Decided by", render: (r) => r.decidedByName ?? "n/a" },
    { key: "at", header: "Decided at", render: (r) => r.decidedAt ?? "n/a" },
    { key: "why", header: "Decision reason", render: (r) => r.decisionReason ?? "n/a" },
    { key: "sub", header: "Submitted", render: (r) => r.createdAt.slice(0, 10) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <form method="get" action="/audit" className="grid gap-4 sm:grid-cols-4 sm:items-end">
        <FormField id="audit-employee" label="Employee" required>
          <Select id="audit-employee" name="userId" defaultValue={selected?.id ?? ""} required>
            <option value="">Choose an employee</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="audit-from" label="From">
          <DateField id="audit-from" name="from" defaultValue={from} />
        </FormField>
        <FormField id="audit-to" label="To">
          <DateField id="audit-to" name="to" defaultValue={to} />
        </FormField>
        <Button type="submit">Run report</Button>
      </form>

      <p className="text-sm text-muted">
        Shows every request the employee has made, however old: decisions are retained for at least
        3 years and never purged. Soft-deleted records are excluded from this view. The
        employee&apos;s own free-text reason is not shown.
      </p>

      {problem ? <Alert tone="error">{problem}</Alert> : null}

      {selected && !problem ? (
        <>
          <h2 className="text-lg font-semibold">{selected.name}</h2>
          <DataTable
            caption={`Leave decision history for ${selected.name}`}
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={
              <EmptyState
                title="No matching requests"
                description="This employee has no requests in this date range."
              />
            }
          />
        </>
      ) : null}

      {!selected && !problem ? (
        <EmptyState
          title="Choose an employee"
          description="The report shows one employee's decision history at a time."
        />
      ) : null}
    </div>
  );
}
