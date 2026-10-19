-- Test for soft_delete_expired_requests() (migration 0008). ONE statement that always ends by raising,
-- so every row it creates or changes is rolled back and nothing persists (leave_requests and audit_log
-- cannot be deleted, so test rows must never be committed).
-- Expected result: an error whose message starts with VERIFY_OK. Anything else is a failure.
do $$
declare
  maria uuid; ana uuid; vac uuid;
  r_old uuid; r_old_rej uuid; r_edge uuid; r_recent uuid; r_pending uuid; r_gone uuid;
  as_of date := '2026-10-19';
  n int; before_rows int; after_rows int; audit_before int; audit_after int;
begin
  select id into maria from public.users where email = 'maria@example.com';
  select id into ana   from public.users where email = 'ana@example.com';
  select id into vac   from public.leave_types where name = 'Vacation';
  if maria is null or ana is null or vac is null then
    raise exception 'VERIFY_FAILED: seed data (seed.sql + seed.dev.sql) is missing';
  end if;

  -- Archive anything that is already eligible, so the counts below belong to this test only.
  perform public.soft_delete_expired_requests(as_of);

  -- cutoff for as_of 2026-10-19 is 2023-10-19: older than that is archived.
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason, status, decided_by, decided_at)
    values (ana, vac, '2023-09-01', '2023-09-02', 'verify old approved', 'approved', maria, '2023-10-18 10:00+00')
    returning id into r_old;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason, status, decided_by, decided_at)
    values (ana, vac, '2020-01-10', '2020-01-10', 'verify old rejected', 'rejected', maria, '2020-01-02 09:00+00')
    returning id into r_old_rej;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason, status, decided_by, decided_at)
    values (ana, vac, '2023-11-01', '2023-11-02', 'verify just inside 3 years', 'approved', maria, '2023-10-20 10:00+00')
    returning id into r_edge;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason, status, decided_by, decided_at)
    values (ana, vac, '2026-10-05', '2026-10-06', 'verify recent', 'approved', maria, '2026-10-01 10:00+00')
    returning id into r_recent;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason, status, created_at)
    values (ana, vac, '2020-05-01', '2020-05-02', 'verify old but still pending', 'pending', '2020-04-01 10:00+00')
    returning id into r_pending;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason, status, decided_by, decided_at, is_deleted)
    values (ana, vac, '2019-01-01', '2019-01-01', 'verify already soft-deleted', 'approved', maria, '2019-01-02 10:00+00', true)
    returning id into r_gone;

  insert into public.audit_log (leave_request_id, actor_id, action) values (r_old, maria, 'approved');
  insert into public.notifications (user_id, leave_request_id, kind) values (ana, r_old, 'request_approved');

  select count(*) into before_rows from public.leave_requests;
  select count(*) into audit_before from public.audit_log;

  -- the run
  begin
    n := public.soft_delete_expired_requests(as_of);
  exception when others then
    raise exception 'VERIFY_FAILED: the retention run errored: %', sqlerrm;
  end;
  if n <> 2 then raise exception 'VERIFY_FAILED: expected exactly 2 requests archived, got %', n; end if;

  -- what was archived
  select count(*) into n from public.leave_requests where id in (r_old, r_old_rej) and is_deleted;
  if n <> 2 then raise exception 'VERIFY_FAILED: requests decided more than 3 years ago were not soft-deleted'; end if;
  select count(*) into n from public.leave_requests where id = r_edge and not is_deleted;
  if n <> 1 then raise exception 'VERIFY_FAILED: a request decided less than 3 years ago was archived'; end if;
  select count(*) into n from public.leave_requests where id = r_recent and not is_deleted;
  if n <> 1 then raise exception 'VERIFY_FAILED: a recent request was archived'; end if;
  select count(*) into n from public.leave_requests where id = r_pending and not is_deleted;
  if n <> 1 then raise exception 'VERIFY_FAILED: a pending request was archived'; end if;
  select count(*) into n from public.leave_requests where id = r_gone and is_deleted;
  if n <> 1 then raise exception 'VERIFY_FAILED: an already soft-deleted request was changed'; end if;

  -- nothing is ever removed
  select count(*) into after_rows from public.leave_requests;
  if after_rows <> before_rows then
    raise exception 'VERIFY_FAILED: archiving changed the number of rows (% -> %)', before_rows, after_rows;
  end if;
  select count(*) into audit_after from public.audit_log;
  if audit_after <> audit_before then
    raise exception 'VERIFY_FAILED: archiving changed the audit log (% -> %)', audit_before, audit_after;
  end if;
  begin
    delete from public.leave_requests where id = r_old;
    raise exception 'VERIFY_FAILED: a soft-deleted request could be hard-deleted';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
  end;

  -- idempotent
  if public.soft_delete_expired_requests(as_of) <> 0 then
    raise exception 'VERIFY_FAILED: a second run archived more requests';
  end if;

  -- bad dates are refused
  begin
    perform public.soft_delete_expired_requests('2099-01-01');
    raise exception 'VERIFY_FAILED: a future date was accepted (it would archive records inside the 3 years)';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm <> 'INVALID_DATE' then raise exception 'VERIFY_FAILED: expected INVALID_DATE, got %', sqlerrm; end if;
  end;
  begin
    perform public.soft_delete_expired_requests(null);
    raise exception 'VERIFY_FAILED: a null date was accepted';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm <> 'INVALID_DATE' then raise exception 'VERIFY_FAILED: expected INVALID_DATE for null, got %', sqlerrm; end if;
  end;

  -- the app no longer shows archived requests anywhere
  select count(*) into n from public.employee_audit_report(ana, null, null) where id = r_old;
  if n <> 0 then raise exception 'VERIFY_FAILED: the audit report still shows an archived request'; end if;
  select count(*) into n from public.employee_audit_report(ana, null, null) where id = r_edge;
  if n <> 1 then raise exception 'VERIFY_FAILED: the audit report lost a request that is inside the 3 years'; end if;
  select count(*) into n from public.team_leave_requests(maria) where id = r_old;
  if n <> 0 then raise exception 'VERIFY_FAILED: the manager queue still shows an archived request'; end if;
  select count(*) into n from public.my_notifications(ana) where leave_request_id = r_old;
  if n <> 0 then raise exception 'VERIFY_FAILED: notifications still show an archived request'; end if;

  raise exception 'VERIFY_OK: only decided requests older than 3 years are soft-deleted, nothing is removed, a repeat changes nothing, bad dates are refused, archived requests drop out of the audit, team and notifications; rolled back';
end;
$$;
