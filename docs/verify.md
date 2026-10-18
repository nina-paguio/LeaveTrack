Task Detail
TASK-010 — Database schema & migrations for leave domain
Create migrations for users, leave_types, leave_policies, leave_balances, leave_requests, audit_log per ARCH-LeaveTrack-v1.0 data model. Seed leave_types with Vacation/Sick/Unpaid.

Migration runs clean on empty DB
All 6 tables exist with FKs matching the arch doc
leave_types seeded with exactly 3 rows
leave_requests.is_deleted defaults to false (no hard-delete path)
TASK-011 — Submit leave request form + API
POST /api/leave-requests. Validate leave_type, start_date, end_date server-side; warn (not block) if requested days exceed balance.

AC1: valid submission creates a pending request and notifies the manager
AC2: end_date before start_date is rejected with a validation error, no row created
AC3: over-balance submission shows a warning but still allows submit
TASK-012 — Leave balance display page
GET /api/leave-requests?scope=mine plus a balance page showing confirmed vs. pending amounts per leave type.

AC1: balance page shows current balance per leave type as of the last accrual run
AC2: pending (unapproved) amounts are shown separately from confirmed balance
TASK-013 — Manager approval queue scoped to direct reports
GET /api/leave-requests?scope=team — filter must be applied in the query itself (WHERE manager_id = :current_user_id), never in application logic only, per the arch doc's security note.

AC1: a manager with 5 direct reports sees exactly those 5 employees' requests, no others
AC2: an org-chart change moving an employee to a new manager moves their pending requests to the new manager's queue
TASK-014 — Approve/reject decision endpoint + audit record
POST /api/leave-requests/:id/decision. On approve: decrement balance, set status approved, write audit_log row. On reject: require a reason, set status rejected, no balance change, write audit_log row. Must 403 if the request's owner is not the caller's direct report.

AC1: approving a direct report's pending request sets status=approved, decrements their balance, and creates an audit_log row
AC2: rejecting with a reason sets status=rejected, balance is unchanged, and creates an audit_log row
AC3: acting on a non-direct-report's request returns 403 and the request never appeared in the queue to begin with
TASK-015 — HR audit report
GET /api/audit/:userId — full decision history for an employee: status, decision-maker, timestamp, going back 3+ years. Must read soft-deleted-excluded rows only, never a hard-delete path.

AC1: querying any employee ID returns every request they've made with status, decided_by, decided_at
AC2: soft-deleted records are excluded from the report, but confirmed to still exist in the table (no purge)
TASK-016 — Mobile-responsive pass on submit + balance pages
Responsive layout for the submit-request form and balance page at 375px width — no horizontal scroll, no desktop-only components.

AC1: submit-request form is fully usable at 375px width with no horizontal scroll
AC2: balance page renders correctly on a mobile browser without a desktop-only layout
TASK-017 — Monthly accrual cron job
Vercel Cron hitting POST /api/jobs/accrual monthly. Reads each user's leave_policies and increments leave_balances by accrual_per_month. Must be idempotent — running it twice in the same month must not double-accrue.

AC1: running the job once increases each user's Vacation balance by exactly their policy's accrual_per_month
AC2: running the job again in the same month is a no-op — balance does not change a second time
TASK-018 — Independent leave-type balance validation
Confirm approving/rejecting a request only ever touches the balance for that request's own leave_type_id — never a sibling leave type. Unpaid leave has no balance policy and must never be blocked by a balance check.

AC1: approving a Sick request decrements only the Sick balance — Vacation and Unpaid balances are unchanged
AC2: requesting Unpaid leave is never blocked by a balance check, since Unpaid has no accrual policy