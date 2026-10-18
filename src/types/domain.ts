// Domain types mirror the data model in docs/arch-docs/ARCH-LeaveTrack-v1.0.md.

export type Role = "employee" | "manager" | "hr_admin";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  managerId: string | null;
}

export interface LeaveType {
  id: string;
  name: string;
  tracksBalance: boolean;
}

export interface LeavePolicy {
  id: string;
  userId: string;
  leaveTypeId: string;
  accrualPerMonth: number;
}

export interface LeaveBalance {
  id: string;
  userId: string;
  leaveTypeId: string;
  balance: number;
  updatedAt: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: RequestStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  /** Why a manager rejected the request (set only on rejection). */
  decisionReason?: string | null;
  isDeleted: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  leaveRequestId: string;
  actorId: string;
  action: "submitted" | "approved" | "rejected";
  occurredAt: string;
}

/** Balance as shown to the employee: confirmed balance plus pending (not yet deducted) days. */
export interface BalanceView {
  leaveTypeId: string;
  leaveTypeName: string;
  tracksBalance: boolean;
  confirmed: number;
  pending: number;
  /** First day of the latest month accrued into this balance (YYYY-MM-01), or null before the first accrual. */
  asOf: string | null;
}
