# ADR-LeaveTrack-E005 — Retention: soft-delete after 3 years

**Status:** Accepted

## Context
BR-04 and the BRD constraints: decision records are retained for a **minimum of 3 years**, with no hard
delete. ARCH: `leave_requests.is_deleted` is "soft delete only". PRD US-05 AC1: the audit report shows
every request "going back at least 3 years"; AC2: soft-deleted records are excluded from views but never
purged. The docs do not say anything must be removed after 3 years. The team decided that records older
than 3 years should stay in the database but no longer be visible in the application.

## Decision
- `soft_delete_expired_requests(p_as_of date)` (migration 0008) sets `is_deleted = true` on requests that
  are not already deleted, are **decided** (not pending), and were decided more than **3 years** before
  `p_as_of`. The 3 years is fixed inside the function; a future date or a null date is refused; a repeat
  run changes nothing. No new table or column: the documented soft-delete column is enough.
- The age is counted from the **decision date** (`decided_at`), because the record being retained is the
  decision. Pending requests are never archived.
- A monthly Vercel Cron call to `/api/jobs/retention` (03:00 UTC on the 1st, after accrual) runs it with
  today's date in Asia/Manila. The route has no session: exact-path proxy exemption, bearer `CRON_SECRET`,
  constant-time compare (shared `lib/auth/cron-auth.ts`), fails closed.
- Every app query already filters on `not is_deleted`, so archived requests drop out of the HR audit
  report, the manager queue, My leave and notifications at once. The delete/truncate triggers still make a
  hard delete impossible, and `audit_log` is untouched.
- The HR audit report is now **one page** listing every request of the chosen employee (US-05 AC1: "every
  request"). Because of this retention it covers at most about 3 years per employee.

## Consequences
- Positive: meets "minimum 3 years", "never purged" and "see every request"; reversible (set `is_deleted`
  back to false); tested in a rolled-back SQL test and mutation-tested.
- Negative / limits: HR can no longer see requests older than 3 years in the app (only via the database);
  there is no screen to view or restore archived records; Legal or compliance should confirm this reverses
  the earlier "no age limit" behaviour of the audit report. The first run archives nothing if no request is
  older than 3 years yet.
- Not stated by the docs, so a team decision: counting from the decision date, and leaving pending requests.
