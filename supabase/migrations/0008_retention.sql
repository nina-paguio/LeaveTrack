-- Retention (BR-04, ADR-LeaveTrack-E005): requests are kept for a MINIMUM of 3 years. A request that
-- was decided more than 3 years ago is soft-deleted (is_deleted = true, the documented soft-delete
-- column). The row stays in the table forever (no hard delete: the delete/truncate triggers still
-- apply), but every query in the app already filters on `not is_deleted`, so it is no longer shown.
--
-- The 3 years is fixed inside the function: there is no way to archive a younger record. Only decided
-- requests are archived (a pending request is still open). It is idempotent: a second run changes
-- nothing. Runs as the caller; only the server-side service_role may execute it.
create function soft_delete_expired_requests(p_as_of date)
returns int
language plpgsql
set search_path = ''
as $$
declare
  archived int;
begin
  -- A date in the future would archive records that are still inside the 3 years. One day of slack
  -- covers Manila being ahead of UTC.
  if p_as_of is null or p_as_of > current_date + 1 then
    raise exception 'INVALID_DATE';
  end if;

  with u as (
    update public.leave_requests
       set is_deleted = true
     where not is_deleted
       and status <> 'pending'
       and decided_at is not null
       and decided_at < (p_as_of - interval '3 years')::timestamptz
     returning 1
  )
  select count(*)::int into archived from u;

  return archived;
end;
$$;

revoke all on function soft_delete_expired_requests(date) from public, anon, authenticated;
grant execute on function soft_delete_expired_requests(date) to service_role;
