import "server-only";
import { z } from "zod";
import type { AccrualRepo, AccrualResult } from "@/lib/leave/accrual";
import type { AuditEntry, AuditRepo, AuditSubject } from "@/lib/leave/audit";
import type { DecideOutcome, DecideRepo, DecisionRefusal } from "@/lib/leave/decide";
import type { MineRepo } from "@/lib/leave/mine";
import type { NotificationRepo } from "@/lib/leave/notifications";
import type { RetentionRepo } from "@/lib/leave/retention";
import type { CreatedRequest, LeaveRepo, RepoLeaveType, RepoUser } from "@/lib/leave/submit";
import type { TeamRepo } from "@/lib/leave/team";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const userRow = z.object({
  id: z.uuid(),
  manager_id: z.uuid().nullable(),
  role: z.enum(["employee", "manager", "hr_admin"]),
});
const teamRequestRow = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  employee_name: z.string(),
  leave_type_id: z.uuid(),
  start_date: z.string(),
  end_date: z.string(),
  reason: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  decided_by: z.uuid().nullable(),
  decided_at: z.string().nullable(),
  is_deleted: z.boolean(),
  created_at: z.string(),
});
const leaveTypeRow = z.object({ id: z.uuid(), name: z.string(), tracks_balance: z.boolean() });
const balanceRow = z.object({ balance: z.coerce.number() });
const balanceListRow = z.object({
  leave_type_id: z.uuid(),
  balance: z.coerce.number(),
  updated_at: z.string(),
  last_accrued_month: z.string().nullable(),
});
const accrualRow = z.object({
  run_month: z.string(),
  accrued: z.number().int(),
  skipped: z.number().int(),
  already_ran: z.boolean(),
});
const fullRequestRow = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  leave_type_id: z.uuid(),
  start_date: z.string(),
  end_date: z.string(),
  reason: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  decided_by: z.uuid().nullable(),
  decided_at: z.string().nullable(),
  is_deleted: z.boolean(),
  created_at: z.string(),
});
const requestRow = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "approved", "rejected"]),
  leave_type_id: z.uuid(),
  start_date: z.string(),
  end_date: z.string(),
  reason: z.string(),
  created_at: z.string(),
});

const subjectRow = z.object({
  id: z.uuid(),
  name: z.string(),
  role: z.enum(["employee", "manager", "hr_admin"]),
});
const auditRow = z.object({
  id: z.uuid(),
  leave_type_name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
  decided_by_name: z.string().nullable(),
  decided_at: z.string().nullable(),
  decision_reason: z.string().nullable(),
});

const notificationRow = z.object({
  id: z.uuid(),
  kind: z.enum(["request_submitted", "request_approved", "request_rejected"]),
  created_at: z.string(),
  read_at: z.string().nullable(),
  leave_request_id: z.uuid(),
  employee_name: z.string(),
  leave_type_name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  decided_by_name: z.string().nullable(),
  decision_reason: z.string().nullable(),
});

const DECISION_REFUSALS = [
  "NOT_FOUND",
  "FORBIDDEN",
  "NOT_PENDING",
  "REASON_REQUIRED",
  "INVALID_DECISION",
] as const;
const decidedRow = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "approved", "rejected"]),
  decided_by: z.uuid(),
  decided_at: z.string(),
  decision_reason: z.string().nullable(),
});

function fail(action: string, message: string): never {
  throw new Error(`${action} failed: ${message}`);
}

export function createLeaveRepo(): LeaveRepo &
  MineRepo &
  TeamRepo &
  DecideRepo &
  AuditRepo &
  AccrualRepo &
  NotificationRepo &
  RetentionRepo {
  const db = getSupabaseAdmin();

  return {
    /** The 3-year rule and the soft delete are inside soft_delete_expired_requests (migration 0008). */
    async archiveExpired(asOf) {
      const { data, error } = await db.rpc("soft_delete_expired_requests", { p_as_of: asOf });
      if (error) fail("archiveExpired", error.message);
      return z.number().int().parse(data);
    },

    /** The recipient filter is inside my_notifications (migration 0007), not here. */
    async listNotifications(userId) {
      const { data, error } = await db.rpc("my_notifications", { p_user_id: userId });
      if (error) fail("listNotifications", error.message);
      return z
        .array(notificationRow)
        .parse(data)
        .map((n) => ({
          id: n.id,
          kind: n.kind,
          createdAt: n.created_at,
          readAt: n.read_at,
          requestId: n.leave_request_id,
          employeeName: n.employee_name,
          leaveTypeName: n.leave_type_name,
          startDate: n.start_date,
          endDate: n.end_date,
          decidedByName: n.decided_by_name,
          decisionReason: n.decision_reason,
        }));
    },

    async countUnread(userId) {
      const { data, error } = await db.rpc("unread_notification_count", { p_user_id: userId });
      if (error) fail("countUnread", error.message);
      return z.number().int().parse(data);
    },

    async markAllRead(userId) {
      const { data, error } = await db.rpc("mark_notifications_read", { p_user_id: userId });
      if (error) fail("markAllRead", error.message);
      return z.number().int().parse(data);
    },

    /** The manager scope is applied inside the SQL function (migration 0003), not here. */
    async listTeamRequests(managerId) {
      const { data, error } = await db.rpc("team_leave_requests", { p_manager_id: managerId });
      if (error) fail("listTeamRequests", error.message);
      return z
        .array(teamRequestRow)
        .parse(data)
        .map((r) => ({
          id: r.id,
          userId: r.user_id,
          employeeName: r.employee_name,
          leaveTypeId: r.leave_type_id,
          startDate: r.start_date,
          endDate: r.end_date,
          reason: r.reason,
          status: r.status,
          decidedBy: r.decided_by,
          decidedAt: r.decided_at,
          isDeleted: r.is_deleted,
          createdAt: r.created_at,
        }));
    },

    /**
     * Scope, exactly-once, balance and audit all happen inside decide_leave_request (migration
     * 0004). Known refusals come back as data; anything else is a real fault and throws.
     */
    async decideRequest(managerId, requestId, input): Promise<DecideOutcome> {
      const { data, error } = await db.rpc("decide_leave_request", {
        p_manager_id: managerId,
        p_request_id: requestId,
        p_decision: input.decision,
        p_reason: input.reason ?? null,
      });
      if (error) {
        if ((DECISION_REFUSALS as readonly string[]).includes(error.message)) {
          return { ok: false, refusal: error.message as DecisionRefusal };
        }
        fail("decideRequest", error.message);
      }
      const row = decidedRow.parse(Array.isArray(data) ? data[0] : data);
      return {
        ok: true,
        request: {
          id: row.id,
          status: row.status,
          decidedBy: row.decided_by,
          decidedAt: row.decided_at,
          decisionReason: row.decision_reason,
        },
      };
    },

    async findUserById(id): Promise<AuditSubject | null> {
      const { data, error } = await db
        .from("users")
        .select("id, name, role")
        .eq("id", id)
        .maybeSingle();
      if (error) fail("findUserById", error.message);
      return data ? subjectRow.parse(data) : null;
    },

    /** The soft-delete exclusion is applied inside the SQL function (migration 0005), not here. */
    async auditReport(userId, range): Promise<AuditEntry[]> {
      const { data, error } = await db.rpc("employee_audit_report", {
        p_user_id: userId,
        p_from: range.from ?? null,
        p_to: range.to ?? null,
      });
      if (error) fail("auditReport", error.message);
      return z
        .array(auditRow)
        .parse(data)
        .map((r) => ({
          id: r.id,
          leaveTypeName: r.leave_type_name,
          startDate: r.start_date,
          endDate: r.end_date,
          status: r.status,
          createdAt: r.created_at,
          decidedByName: r.decided_by_name,
          decidedAt: r.decided_at,
          decisionReason: r.decision_reason,
        }));
    },

    /**
     * The whole accrual (idempotency marker, lock, exact amounts, run log) is inside
     * run_monthly_accrual (migration 0006); this only calls it and shapes the result.
     */
    async runMonthlyAccrual(month): Promise<AccrualResult> {
      const { data, error } = await db.rpc("run_monthly_accrual", { p_month: month });
      if (error) fail("runMonthlyAccrual", error.message);
      const row = accrualRow.parse(Array.isArray(data) ? data[0] : data);
      return {
        month: row.run_month,
        accrued: row.accrued,
        skipped: row.skipped,
        alreadyRun: row.already_ran,
      };
    },

    async requestExists(id) {
      const { data, error } = await db
        .from("leave_requests")
        .select("id")
        .eq("id", id)
        .eq("is_deleted", false)
        .maybeSingle();
      if (error) fail("requestExists", error.message);
      return data !== null;
    },

    async listLeaveTypes(): Promise<RepoLeaveType[]> {
      const { data, error } = await db
        .from("leave_types")
        .select("id, name, tracks_balance")
        .order("name");
      if (error) fail("listLeaveTypes", error.message);
      return z
        .array(leaveTypeRow)
        .parse(data)
        .map((t) => ({ id: t.id, name: t.name, tracksBalance: t.tracks_balance }));
    },

    async listBalances(userId) {
      const { data, error } = await db
        .from("leave_balances")
        .select("leave_type_id, balance, updated_at, last_accrued_month")
        .eq("user_id", userId);
      if (error) fail("listBalances", error.message);
      return z
        .array(balanceListRow)
        .parse(data)
        .map((b) => ({
          leaveTypeId: b.leave_type_id,
          balance: b.balance,
          updatedAt: b.updated_at,
          lastAccruedMonth: b.last_accrued_month,
        }));
    },

    async listRequests(userId) {
      const { data, error } = await db
        .from("leave_requests")
        .select(
          "id, user_id, leave_type_id, start_date, end_date, reason, status, decided_by, decided_at, is_deleted, created_at",
        )
        .eq("user_id", userId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      if (error) fail("listRequests", error.message);
      return z
        .array(fullRequestRow)
        .parse(data)
        .map((r) => ({
          id: r.id,
          userId: r.user_id,
          leaveTypeId: r.leave_type_id,
          startDate: r.start_date,
          endDate: r.end_date,
          reason: r.reason,
          status: r.status,
          decidedBy: r.decided_by,
          decidedAt: r.decided_at,
          isDeleted: r.is_deleted,
          createdAt: r.created_at,
        }));
    },

    async findUserByEmail(email): Promise<RepoUser | null> {
      const { data, error } = await db
        .from("users")
        .select("id, manager_id, role")
        .eq("email", email)
        .maybeSingle();
      if (error) fail("findUserByEmail", error.message);
      if (!data) return null;
      const row = userRow.parse(data);
      return { id: row.id, managerId: row.manager_id, role: row.role };
    },

    async findLeaveType(id): Promise<RepoLeaveType | null> {
      const { data, error } = await db
        .from("leave_types")
        .select("id, name, tracks_balance")
        .eq("id", id)
        .maybeSingle();
      if (error) fail("findLeaveType", error.message);
      if (!data) return null;
      const row = leaveTypeRow.parse(data);
      return { id: row.id, name: row.name, tracksBalance: row.tracks_balance };
    },

    async getBalance(userId, leaveTypeId) {
      const { data, error } = await db
        .from("leave_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("leave_type_id", leaveTypeId)
        .maybeSingle();
      if (error) fail("getBalance", error.message);
      return data ? balanceRow.parse(data).balance : null;
    },

    async createRequest(userId, input): Promise<CreatedRequest> {
      const { data, error } = await db.rpc("submit_leave_request", {
        p_user_id: userId,
        p_leave_type_id: input.leaveTypeId,
        p_start_date: input.startDate,
        p_end_date: input.endDate,
        p_reason: input.reason,
      });
      if (error) fail("createRequest", error.message);
      const row = requestRow.parse(Array.isArray(data) ? data[0] : data);
      return {
        id: row.id,
        status: row.status,
        leaveTypeId: row.leave_type_id,
        startDate: row.start_date,
        endDate: row.end_date,
        reason: row.reason,
        createdAt: row.created_at,
      };
    },
  };
}

/** Real leave types and the user's balances, for the submit form (ids must be database UUIDs). */
export async function loadSubmitFormData(email: string) {
  const db = getSupabaseAdmin();

  const { data: types, error: typesError } = await db
    .from("leave_types")
    .select("id, name, tracks_balance")
    .order("name");
  if (typesError) fail("loadSubmitFormData(types)", typesError.message);

  const { data: user, error: userError } = await db
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (userError) fail("loadSubmitFormData(user)", userError.message);

  const { data: balances, error: balancesError } = user
    ? await db.from("leave_balances").select("leave_type_id, balance").eq("user_id", user.id)
    : { data: [], error: null };
  if (balancesError) fail("loadSubmitFormData(balances)", balancesError.message);

  return {
    leaveTypes: z
      .array(leaveTypeRow)
      .parse(types)
      .map((t) => ({ id: t.id, name: t.name, tracksBalance: t.tracks_balance })),
    balances: z
      .array(z.object({ leave_type_id: z.uuid(), balance: z.coerce.number() }))
      .parse(balances)
      .map((b) => ({ leaveTypeId: b.leave_type_id, confirmed: b.balance })),
  };
}

/** Employees HR can run a report for (names only: no emails, no HR admins). */
export async function listAuditEmployees(): Promise<{ id: string; name: string }[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("users")
    .select("id, name")
    .neq("role", "hr_admin")
    .order("name");
  if (error) fail("listAuditEmployees", error.message);
  return z.array(z.object({ id: z.uuid(), name: z.string() })).parse(data);
}
