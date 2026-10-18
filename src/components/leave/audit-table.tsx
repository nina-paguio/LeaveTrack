import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DateField, Select } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { FormField } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AuditEntry } from "@/lib/leave/audit";
import { formatDate, formatDateRange, formatDateTime } from "@/lib/leave/format";

export interface AuditTableProps {
  employees: { id: string; name: string }[];
  /** The employee the report was run for, or null before one is chosen. */
  selected: { id: string; name: string } | null;
  from: string;
  to: string;
  rows: AuditEntry[];
  /** A message to show instead of a report (bad input, unknown employee). */
  problem: string | null;
  /** Page controls shown under the table. */
  pager?: ReactNode;
}

/**
 * Server-driven: the form is a plain GET, so the report is always one employee's history read
 * through GET /api/audit/:userId's service, never filtered in the browser.
 */
export function AuditTable({
  employees,
  selected,
  from,
  to,
  rows,
  problem,
  pager,
}: AuditTableProps) {
  const columns: Column<AuditEntry>[] = [
    { key: "type", header: "Type", card: "title", render: (r) => r.leaveTypeName },
    {
      key: "dates",
      header: "Leave dates",
      card: "line",
      render: (r) => formatDateRange(r.startDate, r.endDate),
    },
    {
      key: "status",
      header: "Status",
      card: "badge",
      render: (r) => <StatusBadge status={r.status} />,
    },
    { key: "by", header: "Decided by", render: (r) => r.decidedByName },
    {
      key: "at",
      header: "Decided at",
      render: (r) => (r.decidedAt ? formatDateTime(r.decidedAt) : null),
    },
    { key: "why", header: "Decision reason", render: (r) => r.decisionReason },
    { key: "sub", header: "Submitted", render: (r) => formatDate(r.createdAt.slice(0, 10)) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <form
        method="get"
        action="/audit"
        className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:items-end"
      >
        <div className="col-span-2 sm:col-span-1">
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
        </div>
        <FormField id="audit-from" label="From">
          <DateField id="audit-from" name="from" defaultValue={from} />
        </FormField>
        <FormField id="audit-to" label="To">
          <DateField id="audit-to" name="to" defaultValue={to} />
        </FormField>
        <Button type="submit" className="col-span-2 sm:col-span-1">
          Run report
        </Button>
      </form>

      <p className="text-sm text-muted">
        {selected
          ? "Records are kept for at least 3 years and are never purged. The employee’s own reason is not shown."
          : "Choose an employee to see their full decision history. Records are kept for at least 3 years and are never purged."}
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
          {pager}
        </>
      ) : null}
    </div>
  );
}
