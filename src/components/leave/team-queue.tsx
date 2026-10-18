"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { describedBy, FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import type { LeaveRequest } from "@/types/domain";

export interface TeamQueueRow extends LeaveRequest {
  employeeName: string;
  leaveTypeName: string;
}

export interface TeamQueueProps {
  /** Day 1: must come from a query already filtered by manager_id, never filtered here. */
  requests: TeamQueueRow[];
  /** Day 1 wires this to POST /api/leave-requests/:id/decision. */
  onDecision?: (
    id: string,
    decision: "approved" | "rejected",
    reason?: string,
  ) => Promise<void> | void;
}

export function TeamQueue({ requests, onDecision }: TeamQueueProps) {
  const toast = useToast();
  const [rejecting, setRejecting] = useState<TeamQueueRow | null>(null);
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(row: TeamQueueRow, decision: "approved" | "rejected", why?: string) {
    setBusyId(row.id);
    try {
      if (onDecision) await onDecision(row.id, decision, why);
      else toast.show(`Mock only: ${decision} for ${row.employeeName} was not saved.`, "info");
    } catch {
      toast.show("Could not record the decision. Please try again.", "error");
    } finally {
      setBusyId(null);
    }
  }

  function closeDialog() {
    setRejecting(null);
    setReason("");
    setAttempted(false);
  }

  async function confirmReject() {
    setAttempted(true);
    if (!rejecting || !reason.trim()) return;
    const row = rejecting;
    closeDialog();
    await decide(row, "rejected", reason.trim());
  }

  const columns: Column<TeamQueueRow>[] = [
    { key: "employee", header: "Employee", render: (r) => r.employeeName },
    { key: "type", header: "Type", render: (r) => r.leaveTypeName },
    { key: "dates", header: "Dates", render: (r) => `${r.startDate} to ${r.endDate}` },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "Decision",
      render: (r) =>
        r.status === "pending" ? (
          <div className="flex justify-end gap-2">
            <Button loading={busyId === r.id} onClick={() => decide(r, "approved")}>
              Approve
            </Button>
            <Button variant="secondary" disabled={busyId === r.id} onClick={() => setRejecting(r)}>
              Reject
            </Button>
          </div>
        ) : (
          <span className="text-muted">Decided</span>
        ),
    },
  ];

  const error = attempted && !reason.trim() ? "A reason is required to reject." : undefined;

  return (
    <>
      <DataTable
        caption="Leave requests from my direct reports"
        columns={columns}
        rows={requests}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            title="No requests to review"
            description="Requests from your direct reports will appear here."
          />
        }
      />
      <Dialog open={rejecting !== null} title="Reject request" onClose={closeDialog}>
        <FormField id="reject-reason" label="Reason" required error={error}>
          <Textarea
            id="reject-reason"
            value={reason}
            invalid={Boolean(error)}
            aria-describedby={describedBy("reject-reason", { error })}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={closeDialog}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmReject}>
            Reject request
          </Button>
        </div>
      </Dialog>
    </>
  );
}
