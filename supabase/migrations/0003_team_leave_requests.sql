-- TASK-013: the manager's team queue (US-04, BR-02).
-- The scope is the join below: only requests whose owner's manager_id equals p_manager_id.
-- It lives in SQL so it cannot be skipped or reimplemented incorrectly in application code
-- (ARCH, Security: "enforced in the query itself, not in application logic").
-- A manager's own requests are not included (a manager is not their own direct report).
-- Soft-deleted requests are excluded. Runs as the caller; only service_role may execute it.

create function team_leave_requests(p_manager_id uuid)
returns table (
  id              uuid,
  user_id         uuid,
  employee_name   text,
  leave_type_id   uuid,
  start_date      date,
  end_date        date,
  reason          text,
  status          public.request_status,
  decided_by      uuid,
  decided_at      timestamptz,
  is_deleted      boolean,
  created_at      timestamptz
)
language sql
stable
set search_path = ''
as $$
  select r.id, r.user_id, u.name, r.leave_type_id, r.start_date, r.end_date, r.reason,
         r.status, r.decided_by, r.decided_at, r.is_deleted, r.created_at
  from public.leave_requests r
  join public.users u on u.id = r.user_id
  where u.manager_id = p_manager_id
    and not r.is_deleted
  order by r.created_at desc;
$$;

revoke all on function team_leave_requests(uuid) from public, anon, authenticated;
grant execute on function team_leave_requests(uuid) to service_role;
