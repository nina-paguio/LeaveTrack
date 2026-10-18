-- In-app notifications: the manager is notified when an employee submits (US-01 AC1) and the employee
-- when their request is decided (US-03). Written by the SAME database functions, in the same
-- transaction as the request / decision, so a notification can never be missing or left behind.
--
-- Only a kind and a request id are stored; the text (names, type, dates) is built when it is read.
-- The employee's free-text reason is never copied into a notification.
-- Read and write only through the functions below: the recipient filter lives in the SQL, and only the
-- server-side service_role may execute them. RLS is on (deny by default) like every other table.

create type notification_kind as enum ('request_submitted', 'request_approved', 'request_rejected');

create table notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users (id),           -- the recipient
  leave_request_id  uuid not null references leave_requests (id),
  kind              notification_kind not null,
  created_at        timestamptz not null default now(),
  read_at           timestamptz
);
create index notifications_user_created_idx on notifications (user_id, created_at desc);
create index notifications_unread_idx on notifications (user_id) where read_at is null;

alter table notifications enable row level security;

-- ---------------------------------------------------------------------------------------------
-- submit_leave_request: unchanged except for the notification at the end. The employee's manager
-- (users.manager_id) is the only recipient; an employee with no manager creates no notification.
create or replace function submit_leave_request(
  p_user_id        uuid,
  p_leave_type_id  uuid,
  p_start_date     date,
  p_end_date       date,
  p_reason         text
) returns public.leave_requests
language plpgsql
set search_path = ''
as $$
declare
  r public.leave_requests;
begin
  -- The table's own check (end_date >= start_date) rejects bad ranges: nothing is inserted (AC2).
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
  values (p_user_id, p_leave_type_id, p_start_date, p_end_date, p_reason)
  returning * into r;

  insert into public.audit_log (leave_request_id, actor_id, action)
  values (r.id, p_user_id, 'submitted');

  insert into public.notifications (user_id, leave_request_id, kind)
  select u.manager_id, r.id, 'request_submitted'
    from public.users u
   where u.id = p_user_id and u.manager_id is not null;

  return r;
end;
$$;

revoke all on function submit_leave_request(uuid, uuid, date, date, text)
  from public, anon, authenticated;
grant execute on function submit_leave_request(uuid, uuid, date, date, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- decide_leave_request: unchanged except for the notification at the end. Scope check, exactly-once,
-- balance and audit are exactly as in migration 0004. The request's owner is the only recipient. A
-- refused decision raises before reaching this point, so it can never leave a notification behind.
create or replace function decide_leave_request(
  p_manager_id  uuid,
  p_request_id  uuid,
  p_decision    text,   -- 'approve' | 'reject'
  p_reason      text
) returns public.leave_requests
language plpgsql
set search_path = ''
as $$
declare
  r             public.leave_requests;
  manager_role  public.user_role;
  owner_manager uuid;
  tracks        boolean;
  days          int;
begin
  if p_decision is null or p_decision not in ('approve', 'reject') then
    raise exception 'INVALID_DECISION';
  end if;
  if p_decision = 'reject' and (p_reason is null or btrim(p_reason) = '') then
    raise exception 'REASON_REQUIRED';
  end if;

  -- The caller must be a manager in the database (not just claim to be one).
  select role into manager_role from public.users where id = p_manager_id;
  if p_manager_id is null or manager_role is distinct from 'manager' then
    raise exception 'FORBIDDEN';
  end if;

  -- Lock the row: two simultaneous decisions on the same request run one after the other.
  select * into r from public.leave_requests where id = p_request_id and not is_deleted for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  -- Scope, enforced here in SQL: the owner's manager_id must be the caller.
  -- A manager can never decide their own request.
  select manager_id into owner_manager from public.users where id = r.user_id;
  if r.user_id = p_manager_id or owner_manager is null or owner_manager <> p_manager_id then
    raise exception 'FORBIDDEN';
  end if;

  -- Exactly once: a second decision never decrements the balance a second time.
  if r.status <> 'pending' then
    raise exception 'NOT_PENDING';
  end if;

  update public.leave_requests
     set status = case when p_decision = 'approve' then 'approved'::public.request_status
                       else 'rejected'::public.request_status end,
         decided_by = p_manager_id,
         decided_at = now(),
         decision_reason = nullif(btrim(p_reason), '')
   where id = r.id
   returning * into r;

  -- Approving spends the request's own leave type only, and only if that type tracks a balance
  -- (Unpaid has none). Inclusive calendar days, weekends included (same rule as lib/leave/days.ts).
  -- Rejecting never touches a balance. The balance may go below zero: submit already warns but
  -- allows over-balance requests "for HR override".
  if p_decision = 'approve' then
    select tracks_balance into tracks from public.leave_types where id = r.leave_type_id;
    if tracks then
      days := (r.end_date - r.start_date) + 1;
      insert into public.leave_balances (user_id, leave_type_id, balance)
        values (r.user_id, r.leave_type_id, -days)
      on conflict (user_id, leave_type_id)
        do update set balance = public.leave_balances.balance - days, updated_at = now();
    end if;
  end if;

  insert into public.audit_log (leave_request_id, actor_id, action)
    values (r.id, p_manager_id, case when p_decision = 'approve' then 'approved' else 'rejected' end);

  insert into public.notifications (user_id, leave_request_id, kind)
    values (r.user_id, r.id, case when p_decision = 'approve' then 'request_approved'::public.notification_kind else 'request_rejected'::public.notification_kind end);

  return r;
end;
$$;

revoke all on function decide_leave_request(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function decide_leave_request(uuid, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- The caller's own notifications, newest first, at most 200 (the page pages through them). Requests
-- that were soft-deleted are left out.
create function my_notifications(p_user_id uuid)
returns table (
  id                uuid,
  kind              public.notification_kind,
  created_at        timestamptz,
  read_at           timestamptz,
  leave_request_id  uuid,
  employee_name     text,
  leave_type_name   text,
  start_date        date,
  end_date          date,
  decided_by_name   text,
  decision_reason   text
)
language sql
stable
set search_path = ''
as $$
  select n.id, n.kind, n.created_at, n.read_at, r.id, owner.name, t.name,
         r.start_date, r.end_date, mgr.name, r.decision_reason
    from public.notifications n
    join public.leave_requests r on r.id = n.leave_request_id and not r.is_deleted
    join public.users owner on owner.id = r.user_id
    join public.leave_types t on t.id = r.leave_type_id
    left join public.users mgr on mgr.id = r.decided_by
   where n.user_id = p_user_id
   order by n.created_at desc
   limit 200;
$$;

revoke all on function my_notifications(uuid) from public, anon, authenticated;
grant execute on function my_notifications(uuid) to service_role;

-- How many of the caller's notifications are unread (the nav badge). Counts exactly what the list
-- would show, so the badge and the list never disagree.
create function unread_notification_count(p_user_id uuid)
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int
    from public.notifications n
    join public.leave_requests r on r.id = n.leave_request_id and not r.is_deleted
   where n.user_id = p_user_id
     and n.read_at is null;
$$;

revoke all on function unread_notification_count(uuid) from public, anon, authenticated;
grant execute on function unread_notification_count(uuid) to service_role;

-- Marks the caller's unread notifications as read. It can never touch anyone else's. Returns how many
-- changed.
create function mark_notifications_read(p_user_id uuid)
returns int
language plpgsql
set search_path = ''
as $$
declare
  changed int;
begin
  with u as (
    update public.notifications
       set read_at = now()
     where user_id = p_user_id and read_at is null
     returning 1
  )
  select count(*)::int into changed from u;
  return changed;
end;
$$;

revoke all on function mark_notifications_read(uuid) from public, anon, authenticated;
grant execute on function mark_notifications_read(uuid) to service_role;
