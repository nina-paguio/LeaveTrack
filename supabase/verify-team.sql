-- TASK-013 scope test. ONE statement that always ends by raising, so every row it creates is
-- rolled back and nothing persists (leave_requests cannot be deleted, so we must never commit test rows).
-- Expected result: an error whose message starts with VERIFY_OK. Anything else is a failure.
--
-- AC1: a manager with exactly 5 direct reports sees those reports' requests and no others.
-- AC2: moving an employee to another manager moves their pending request to the new manager's queue.
do $$
declare
  maria uuid; paolo uuid; ana uuid; ben uuid; carla uuid; dan uuid; vac uuid;
  e4 uuid; e5 uuid;
  r_ana uuid; r_ben uuid; r_e4 uuid; r_e5 uuid;
  r_dan uuid; r_deleted uuid; r_maria uuid;
  n int;
begin
  select id into maria from public.users where email = 'maria@example.com';
  select id into paolo from public.users where email = 'paolo@example.com';
  select id into ana   from public.users where email = 'ana@example.com';
  select id into ben   from public.users where email = 'ben@example.com';
  select id into carla from public.users where email = 'carla@example.com';
  select id into dan   from public.users where email = 'dan@example.com';
  select id into vac   from public.leave_types where name = 'Vacation';
  if maria is null or paolo is null or ana is null or ben is null or carla is null or dan is null or vac is null then
    raise exception 'VERIFY_FAILED: seed data (seed.sql + seed.dev.sql) is missing';
  end if;

  -- Give Maria exactly 5 direct reports: Ana, Ben, Carla plus two new employees.
  insert into public.users (name, email, role, manager_id)
    values ('Verify Four', 'verify4-' || gen_random_uuid() || '@example.invalid', 'employee', maria) returning id into e4;
  insert into public.users (name, email, role, manager_id)
    values ('Verify Five', 'verify5-' || gen_random_uuid() || '@example.invalid', 'employee', maria) returning id into e5;

  -- One pending request per new report, plus decoys that must NEVER appear in Maria's queue.
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (ana, vac, '2026-12-01', '2026-12-01', 'verify ana') returning id into r_ana;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (ben, vac, '2026-12-02', '2026-12-02', 'verify ben') returning id into r_ben;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (e4, vac, '2026-12-03', '2026-12-03', 'verify e4') returning id into r_e4;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (e5, vac, '2026-12-04', '2026-12-04', 'verify e5') returning id into r_e5;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (dan, vac, '2026-12-05', '2026-12-05', 'verify dan (other team)') returning id into r_dan;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason, is_deleted)
    values (ana, vac, '2026-12-06', '2026-12-06', 'verify soft-deleted', true) returning id into r_deleted;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (maria, vac, '2026-12-07', '2026-12-07', 'verify maria own') returning id into r_maria;

  -- AC1: all four new reports' requests are present.
  select count(*) into n from public.team_leave_requests(maria) t where t.id in (r_ana, r_ben, r_e4, r_e5);
  if n <> 4 then raise exception 'VERIFY_FAILED AC1: expected 4 report requests in Maria''s queue, got %', n; end if;

  -- AC1: nothing from another team, the soft-deleted one, or Maria's own.
  select count(*) into n from public.team_leave_requests(maria) t where t.id in (r_dan, r_deleted, r_maria);
  if n <> 0 then raise exception 'VERIFY_FAILED AC1: % request(s) that must not be visible leaked into Maria''s queue', n; end if;

  -- AC1: every row belongs to one of her exactly-5 direct reports.
  select count(*) into n from public.team_leave_requests(maria) t
    where t.user_id not in (ana, ben, carla, e4, e5);
  if n <> 0 then raise exception 'VERIFY_FAILED AC1: % row(s) from non-reports in Maria''s queue', n; end if;

  -- The other manager sees only her own team (Dan), not Maria's.
  select count(*) into n from public.team_leave_requests(paolo) t where t.id in (r_ana, r_ben, r_e4, r_e5);
  if n <> 0 then raise exception 'VERIFY_FAILED AC1: Maria''s reports'' requests leaked into Paolo''s queue'; end if;
  select count(*) into n from public.team_leave_requests(paolo) t where t.id = r_dan;
  if n <> 1 then raise exception 'VERIFY_FAILED AC1: Dan''s request missing from Paolo''s queue'; end if;

  -- A user with no reports has an empty queue.
  select count(*) into n from public.team_leave_requests(ana);
  if n <> 0 then raise exception 'VERIFY_FAILED: an employee with no reports has % queue rows', n; end if;

  -- AC2: org-chart change. Ben moves from Maria to Paolo.
  update public.users set manager_id = paolo where id = ben;

  select count(*) into n from public.team_leave_requests(maria) t where t.id = r_ben;
  if n <> 0 then raise exception 'VERIFY_FAILED AC2: Ben''s request is still in Maria''s queue after the move'; end if;
  select count(*) into n from public.team_leave_requests(paolo) t where t.id = r_ben;
  if n <> 1 then raise exception 'VERIFY_FAILED AC2: Ben''s pending request did not move to Paolo''s queue'; end if;
  -- The rest of Maria's team is unaffected.
  select count(*) into n from public.team_leave_requests(maria) t where t.id in (r_ana, r_e4, r_e5);
  if n <> 3 then raise exception 'VERIFY_FAILED AC2: the move disturbed the rest of Maria''s queue'; end if;

  raise exception 'VERIFY_OK: AC1 (exactly 5 reports, no leaks) and AC2 (request moves with the employee), rolled back';
end;
$$;
