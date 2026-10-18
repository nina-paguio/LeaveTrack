import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import type { LeaveRequest } from "@/types/domain";

export interface RequestListProps {
  requests: LeaveRequest[];
  /** Resolves a leave type id to its display name. */
  leaveTypeName: (id: string) => string;
}

export function RequestList({ requests, leaveTypeName }: RequestListProps) {
  const columns: Column<LeaveRequest>[] = [
    { key: "type", header: "Type", render: (r) => leaveTypeName(r.leaveTypeId) },
    { key: "dates", header: "Dates", render: (r) => `${r.startDate} to ${r.endDate}` },
    { key: "reason", header: "Reason", render: (r) => r.reason },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <DataTable
      caption="My leave requests"
      columns={columns}
      rows={requests}
      rowKey={(r) => r.id}
      empty={
        <EmptyState
          title="No requests yet"
          description="Requests you submit will appear here with their status."
          action={
            <Link href="/leave/new">
              <Button>New request</Button>
            </Link>
          }
        />
      }
    />
  );
}
