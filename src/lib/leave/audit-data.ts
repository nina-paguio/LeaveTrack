import "server-only";
import { getAuditReport, type AuditEntry } from "@/lib/leave/audit";
import { createLeaveRepo, listAuditEmployees } from "@/lib/leave/repo";
import { auditQuerySchema } from "@/lib/leave/validate";
import { AppError } from "@/lib/errors";
import type { Session } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { leaveTypeById, requests, userById, users } from "@/mocks/data";
import { z } from "zod";

export interface AuditPageParams {
  userId?: string;
  from?: string;
  to?: string;
}

export interface AuditPageData {
  /** false when no database is configured and the data below is mock data. */
  live: boolean;
  employees: { id: string; name: string }[];
  selected: { id: string; name: string } | null;
  from: string;
  to: string;
  rows: AuditEntry[];
  /** A message to show instead of a report (bad input, unknown employee). */
  problem: string | null;
}

const employeesOnly = (list: typeof users) =>
  list.filter((u) => u.role !== "hr_admin").map((u) => ({ id: u.id, name: u.name }));

/**
 * For the HR audit page. The report is per employee: with no employee chosen nothing is loaded,
 * so the page never dumps everyone's history at once.
 */
export async function loadAudit(session: Session, params: AuditPageParams): Promise<AuditPageData> {
  const live = isSupabaseConfigured();
  const from = params.from ?? "";
  const to = params.to ?? "";
  const base = { live, from, to, rows: [] as AuditEntry[], selected: null, problem: null };

  const employees = live ? await listAuditEmployees() : employeesOnly(users);
  if (!params.userId) return { ...base, employees };

  const range = auditQuerySchema.safeParse({ from: from || undefined, to: to || undefined });
  if (!range.success) {
    return { ...base, employees, problem: range.error.issues[0]?.message ?? "Invalid date range." };
  }

  if (!live) {
    const subject = users.find((u) => u.id === params.userId);
    if (!subject) return { ...base, employees, problem: "Employee not found." };
    const rows = requests
      .filter(
        (r) =>
          r.userId === subject.id &&
          !r.isDeleted &&
          (!range.data.from || r.endDate >= range.data.from) &&
          (!range.data.to || r.startDate <= range.data.to),
      )
      .map((r) => ({
        id: r.id,
        leaveTypeName: leaveTypeById(r.leaveTypeId)?.name ?? "Unknown",
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
        createdAt: r.createdAt,
        decidedByName: r.decidedBy ? (userById(r.decidedBy)?.name ?? "Unknown") : null,
        decidedAt: r.decidedAt,
        decisionReason: null,
      }));
    return { ...base, employees, selected: { id: subject.id, name: subject.name }, rows };
  }

  if (!z.uuid().safeParse(params.userId).success) {
    return { ...base, employees, problem: "Employee not found." };
  }
  try {
    const report = await getAuditReport(
      createLeaveRepo(),
      session.user.email,
      params.userId,
      range.data,
    );
    return { ...base, employees, selected: report.employee, rows: report.requests };
  } catch (err) {
    if (err instanceof AppError && err.status === 404) {
      return { ...base, employees, problem: "Employee not found." };
    }
    throw err;
  }
}
