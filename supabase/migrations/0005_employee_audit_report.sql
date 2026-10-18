-- TASK-015: the HR audit report (US-05, BR-04).
-- One employee's complete decision history: every non-deleted request with its status, who decided
-- it and when. The "soft-deleted rows are excluded" rule lives here in SQL so it cannot be skipped.
--
-- Retention: there is deliberately NO age limit. Requests are kept 3+ years (BR-04) and nothing
-- purges them, so the report simply returns everything that exists.
-- The employee's own free-text reason is NOT returned (it can be sensitive); the manager's decision
-- reason is. Date range (optional): requests whose leave dates overlap [p_from, p_to].
-- Read-only. Runs as the caller; only service_role may execute it.

create function employee_audit_report(
  p_user_id  uuid,
  p_from     date default null,
  p_to       date default null
)
returns table (
  id               uuid,
  user_id          uuid,
  employee_name    text,
  leave_type_name  text,
  start_date       date,
  end_date         date,
  status           public.request_status,
  decided_by_name  text,
  decided_at       timestamptz,
  decision_reason  text,
  created_at       timestamptz
)
language sql
stable
set search_path = ''
as $$
  select r.id, r.user_id, e.name, t.name, r.start_date, r.end_date, r.status,
         d.name, r.decided_at, r.decision_reason, r.created_at
  from public.leave_requests r
  join public.users e on e.id = r.user_id
  join public.leave_types t on t.id = r.leave_type_id
  left join public.users d on d.id = r.decided_by
  where r.user_id = p_user_id
    and not r.is_deleted
    and (p_from is null or r.end_date >= p_from)
    and (p_to is null or r.start_date <= p_to)
  order by r.start_date desc, r.created_at desc;
$$;

revoke all on function employee_audit_report(uuid, date, date) from public, anon, authenticated;
grant execute on function employee_audit_report(uuid, date, date) to service_role;
