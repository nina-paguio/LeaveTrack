-- TASK-014: a manager approves or rejects a direct report's pending request (US-03, BR-02, BR-04).
-- Everything happens in ONE transaction inside decide_leave_request(): the scope check, the
-- exactly-once check, the status change, the balance change and the audit row. Nothing here can be
-- skipped or reordered by application code.

-- Why a request was rejected (the employee's own reason lives in leave_requests.reason).
alter table leave_requests add column decision_reason text;

-- Nobody is their own manager: that would put their own request in their own queue and let them
-- approve it (see knowledge/retros/day0-backlog.md #29).
alter table users add constraint users_not_own_manager
  check (manager_id is null or manager_id <> id);

-- Raises one of these messages (the server maps them to HTTP errors):
--   INVALID_DECISION, REASON_REQUIRED, FORBIDDEN, NOT_FOUND, NOT_PENDING
create function decide_leave_request(
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

  return r;
end;
$$;

revoke all on function decide_leave_request(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function decide_leave_request(uuid, uuid, text, text) to service_role;
