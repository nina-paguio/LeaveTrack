-- TASK-015 test for employee_audit_report(). ONE statement that always ends by raising, so every row it
-- creates is rolled back and nothing persists (leave_requests cannot be deleted, so test rows must never
-- be committed). Expected result: an error whose message starts with VERIFY_OK.
--
-- AC1: any employee's report returns every request they made with status, decided_by and decided_at.
-- AC2: soft-deleted records are excluded from the report but still exist in the table (no purge).
do $$
declare
  maria uuid; vac uuid; e_t uuid; e_o uuid;
  r_pend uuid; r_app uuid; r_rej uuid; r_old uuid; r_span uuid; r_del uuid; r_other uuid;
  n int; rec record; ids uuid[];
begin
  select id into maria from public.users where email = 'maria@example.com';
  select id into vac   from public.leave_types where name = 'Vacation';
  if maria is null or vac is null then
    raise exception 'VERIFY_FAILED: seed data (seed.sql + seed.dev.sql) is missing';
  end if;

  insert into public.users (name, email, role, manager_id)
    values ('Verify Subject', 'vsubj-' || gen_random_uuid() || '@example.invalid', 'employee', maria) returning id into e_t;
  insert into public.users (name, email, role, manager_id)
    values ('Verify Other', 'voth-' || gen_random_uuid() || '@example.invalid', 'employee', maria) returning id into e_o;

  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (e_t, vac, '2026-12-01', '2026-12-01', 'SECRET employee reason: pending') returning id into r_pend;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason, status, decided_by, decided_at)
    values (e_t, vac, '2026-11-02', '2026-11-03', 'SECRET employee reason: approved', 'approved', maria, '2026-11-01T10:00:00Z') returning id into r_app;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason, status, decided_by, decided_at, decision_reason)
    values (e_t, vac, '2026-11-10', '2026-11-11', 'SECRET employee reason: rejected', 'rejected', maria, '2026-11-05T09:30:00Z', 'No cover that week') returning id into r_rej;
  -- More than 3 years old: must still be returned (retention is 3+ years, there is no age cut-off).
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason, status, decided_by, decided_at)
    values (e_t, vac, '2021-03-01', '2021-03-02', 'old', 'approved', maria, '2021-02-20T08:00:00Z') returning id into r_old;
  -- Spans a range boundary: used to prove the date range is an overlap test.
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason, status, decided_by, decided_at)
    values (e_t, vac, '2026-11-28', '2026-12-03', 'span', 'approved', maria, '2026-11-20T08:00:00Z') returning id into r_span;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason, is_deleted)
    values (e_t, vac, '2026-12-06', '2026-12-06', 'soft-deleted', true) returning id into r_del;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (e_o, vac, '2026-12-08', '2026-12-08', 'another employee') returning id into r_other;

  ---------------------------------------------------------------- AC1: complete and exact
  select array_agg(id) into ids from public.employee_audit_report(e_t);
  if ids is null or not (ids @> array[r_pend, r_app, r_rej, r_old, r_span]) then
    raise exception 'VERIFY_FAILED AC1: a request is missing from the report';
  end if;
  select count(*) into n from public.employee_audit_report(e_t);
  if n <> 5 then raise exception 'VERIFY_FAILED AC1: expected exactly 5 requests, got %', n; end if;
  select count(*) into n from public.employee_audit_report(e_t) t where t.user_id <> e_t;
  if n <> 0 then raise exception 'VERIFY_FAILED AC1: % row(s) from another employee leaked in', n; end if;
  select count(*) into n from public.employee_audit_report(e_t) t where t.id = r_other;
  if n <> 0 then raise exception 'VERIFY_FAILED AC1: another employee''s request is in the report'; end if;

  -- AC1: status, decided_by and decided_at are right for each state.
  select * into rec from public.employee_audit_report(e_t) t where t.id = r_app;
  if rec.status is distinct from 'approved' or rec.decided_by_name is distinct from 'Maria Santos' or rec.decided_at is distinct from '2026-11-01T10:00:00Z' then
    raise exception 'VERIFY_FAILED AC1: approved row has wrong status/decider/time (%, %, %)', rec.status, rec.decided_by_name, rec.decided_at;
  end if;
  select * into rec from public.employee_audit_report(e_t) t where t.id = r_rej;
  if rec.status is distinct from 'rejected' or rec.decided_by_name is distinct from 'Maria Santos' or rec.decided_at is distinct from '2026-11-05T09:30:00Z'
     or rec.decision_reason is distinct from 'No cover that week' then
    raise exception 'VERIFY_FAILED AC1: rejected row has wrong status/decider/time/reason';
  end if;
  select * into rec from public.employee_audit_report(e_t) t where t.id = r_pend;
  if rec.status is distinct from 'pending' or rec.decided_by_name is not null or rec.decided_at is not null then
    raise exception 'VERIFY_FAILED AC1: pending row should have no decider or decision time';
  end if;
  if rec.employee_name is distinct from 'Verify Subject' or rec.leave_type_name is distinct from 'Vacation' then
    raise exception 'VERIFY_FAILED AC1: employee or leave type name wrong';
  end if;

  -- Retention: the 2021 request (more than 3 years old) is still there.
  select count(*) into n from public.employee_audit_report(e_t) t where t.id = r_old;
  if n <> 1 then raise exception 'VERIFY_FAILED: a request older than 3 years was dropped from the report'; end if;

  ---------------------------------------------------------------- privacy: no employee free text
  select count(*) into n from public.employee_audit_report(e_t) t where t::text like '%SECRET employee reason%';
  if n <> 0 then raise exception 'VERIFY_FAILED: the employee''s own reason text is in the report'; end if;

  ---------------------------------------------------------------- AC2: soft-deleted excluded, never purged
  select count(*) into n from public.employee_audit_report(e_t) t where t.id = r_del;
  if n <> 0 then raise exception 'VERIFY_FAILED AC2: a soft-deleted request is in the report'; end if;
  select count(*) into n from public.leave_requests where id = r_del and is_deleted;
  if n <> 1 then raise exception 'VERIFY_FAILED AC2: the soft-deleted row no longer exists in the table'; end if;
  begin
    delete from public.leave_requests where id = r_del;
    raise exception 'VERIFY_FAILED AC2: a hard delete was allowed';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm not like 'Hard delete is not allowed%' then raise exception 'VERIFY_FAILED AC2: unexpected error on delete: %', sqlerrm; end if;
  end;
  select count(*) into n from public.leave_requests where id = r_del;
  if n <> 1 then raise exception 'VERIFY_FAILED AC2: the row vanished after a delete attempt'; end if;

  ---------------------------------------------------------------- date range = overlap of leave dates
  select array_agg(id) into ids from public.employee_audit_report(e_t, '2026-12-02', '2026-12-31');
  if ids is distinct from array[r_span] then
    raise exception 'VERIFY_FAILED: 2 Dec to 31 Dec should return only the request spanning into it';
  end if;
  select count(*) into n from public.employee_audit_report(e_t, '2026-12-01', '2026-12-01') t where t.id in (r_pend, r_span);
  if n <> 2 then raise exception 'VERIFY_FAILED: a one-day range on 1 Dec should include both overlapping requests (got %)', n; end if;
  select count(*) into n from public.employee_audit_report(e_t, '2026-12-02', '2026-12-02') t where t.id = r_pend;
  if n <> 0 then raise exception 'VERIFY_FAILED: a request that ended on 1 Dec matched a range starting 2 Dec'; end if;
  select count(*) into n from public.employee_audit_report(e_t, null, '2026-11-30') t where t.id in (r_old, r_app, r_rej, r_span);
  if n <> 4 then raise exception 'VERIFY_FAILED: an open-start range up to 30 Nov should include 4 requests (got %)', n; end if;
  select count(*) into n from public.employee_audit_report(e_t, '2026-11-01', '2026-11-01') t where t.id = r_old;
  if n <> 0 then raise exception 'VERIFY_FAILED: the 2021 request matched a November 2026 range'; end if;

  ---------------------------------------------------------------- unknown / null user
  select count(*) into n from public.employee_audit_report('00000000-0000-4000-8000-000000000000');
  if n <> 0 then raise exception 'VERIFY_FAILED: an unknown user returned rows'; end if;
  select count(*) into n from public.employee_audit_report(null);
  if n <> 0 then raise exception 'VERIFY_FAILED: a null user returned rows'; end if;

  raise exception 'VERIFY_OK: AC1 complete and exact, AC2 soft-deleted excluded but kept, retention, privacy, date range; rolled back';
end;
$$;
