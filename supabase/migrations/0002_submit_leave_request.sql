-- TASK-011: create a leave request and its audit row atomically (US-01 AC1).
-- supabase-js has no multi-statement transactions, so this lives in one function called through rpc.
-- Runs as the caller (security invoker). Only the server-side service_role may execute it.

create function submit_leave_request(
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

  return r;
end;
$$;

revoke all on function submit_leave_request(uuid, uuid, date, date, text)
  from public, anon, authenticated;
grant execute on function submit_leave_request(uuid, uuid, date, date, text) to service_role;
