import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { RepoUser } from "@/lib/leave/submit";
import type { AuditQuery } from "@/lib/leave/validate";
import { logger } from "@/lib/logger";
import type { RequestStatus, Role } from "@/types/domain";

/**
 * One row of the HR audit report (US-05). Deliberately has no field for the employee's own
 * free-text reason (it can be sensitive); the manager's decision reason is included.
 */
export interface AuditEntry {
  id: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  status: RequestStatus;
  createdAt: string;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
}

export interface AuditSubject {
  id: string;
  name: string;
  role: Role;
}

export interface AuditReport {
  employee: { id: string; name: string };
  filters: { from: string | null; to: string | null };
  requests: AuditEntry[];
}

/**
 * Read access for the HR audit report. `auditReport` MUST exclude soft-deleted rows in the query
 * itself (see employee_audit_report in migration 0005); this layer never filters them.
 */
export interface AuditRepo {
  findUserByEmail(email: string): Promise<RepoUser | null>;
  findUserById(id: string): Promise<AuditSubject | null>;
  auditReport(userId: string, range: AuditQuery): Promise<AuditEntry[]>;
}

/** The database role is the authority: a session that says "hr_admin" is not enough. */
async function requireHrAdmin(repo: Pick<AuditRepo, "findUserByEmail">, email: string) {
  const user = await repo.findUserByEmail(email);
  if (!user) throw new AppError("NOT_FOUND", "Your user profile was not found.", 404);
  if (user.role !== "hr_admin") {
    throw new AppError("FORBIDDEN", "You do not have access to this resource.", 403);
  }
  return user;
}

/**
 * US-05. `range` must already be validated (auditQuerySchema). Order matters: the role check comes
 * first, so a non-HR caller gets 403 whatever the id is; only then is a malformed id a 404
 * (Postgres would raise an error, i.e. a 500, if asked about it).
 */
export async function getAuditReport(
  repo: AuditRepo,
  actorEmail: string,
  userId: string,
  range: AuditQuery,
): Promise<AuditReport> {
  const actor = await requireHrAdmin(repo, actorEmail);

  if (!z.uuid().safeParse(userId).success) {
    throw new AppError("NOT_FOUND", "Employee not found.", 404);
  }
  const subject = await repo.findUserById(userId);
  if (!subject) throw new AppError("NOT_FOUND", "Employee not found.", 404);

  const requests = await repo.auditReport(subject.id, range);

  // Who looked at whose history: a lightweight access trail (a log line; no table yet).
  logger.info("audit_report_viewed", {
    actorId: actor.id,
    subjectId: subject.id,
    from: range.from ?? null,
    to: range.to ?? null,
    rows: requests.length,
  });

  return {
    employee: { id: subject.id, name: subject.name },
    filters: { from: range.from ?? null, to: range.to ?? null },
    requests,
  };
}
