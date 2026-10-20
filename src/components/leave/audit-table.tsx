import { DataTable, type Column } from "@/components/ui/data-table";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AuditEntry } from "@/lib/leave/audit";
import { formatDate, formatDateRange, formatDateTime } from "@/lib/leave/format";

export interface AuditTableProps {
  /** The employee the report was run for, or null before one is chosen. */
  selected: { id: string; name: string } | null;
  rows: AuditEntry[];
  /** A message to show instead of a report (bad input, unknown employee). */
  problem: string | null;
}

/**
 * The report area. Server-driven: the filters (AuditFilters) are a plain GET, so the report is always
 * one employee's history read through the audit service, never filtered in the browser.
 */
export function AuditTable({ selected, rows, problem }: AuditTableProps) {
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
      <p className="text-sm text-muted">
        {selected
          ? "Every request is listed on this page. Requests more than 3 years after their decision are archived and not shown. The employee’s own reason is not shown."
          : "Choose an employee to see their full decision history. Requests more than 3 years after their decision are archived and not shown."}
      </p>

      {problem ? <Alert tone="error">{problem}</Alert> : null}

      {selected && !problem ? (
        <>
          <h2 className="text-lg font-semibold">
            {selected.name}
            <span className="ml-2 text-sm font-normal text-muted">
              {rows.length} {rows.length === 1 ? "request" : "requests"}
            </span>
          </h2>
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
    </div>
  );
}
