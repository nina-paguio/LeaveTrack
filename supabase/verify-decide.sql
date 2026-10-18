-- TASK-014 test for decide_leave_request(). ONE statement that always ends by raising, so every row,
-- balance change and audit row it creates is rolled back and nothing persists (leave_requests and
-- audit_log cannot be deleted, so test rows must never be committed).
-- Expected result: an error whose message starts with VERIFY_OK. Anything else is a failure.
do $$
declare
  maria uuid; ana uuid; dan uuid; vac uuid; unp uuid; sick uuid;
  r_app uuid; r_rej uuid; r_span uuid; r_unp uuid; r_dan uuid; r_del uuid; r_maria uuid; r_nobal uuid;
  r_sick1 uuid; r_sick2 uuid; r_vac2 uuid; r_unp2 uuid;
  res public.leave_requests;
  bal numeric; total_before numeric; total_after numeric; n int; msg text;
begin
  select id into maria from public.users where email = 'maria@example.com';
  select id into ana   from public.users where email = 'ana@example.com';
  select id into dan   from public.users where email = 'dan@example.com';
  select id into vac   from public.leave_types where name = 'Vacation';
  select id into unp   from public.leave_types where name = 'Unpaid';
  select id into sick  from public.leave_types where name = 'Sick';
  if maria is null or ana is null or dan is null or vac is null or unp is null or sick is null then
    raise exception 'VERIFY_FAILED: seed data (seed.sql + seed.dev.sql) is missing';
  end if;

  -- Known starting balance: Ana has 10 Vacation days.
  insert into public.leave_balances (user_id, leave_type_id, balance) values (ana, vac, 10)
    on conflict (user_id, leave_type_id) do update set balance = 10;

  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (ana, vac, '2026-12-01', '2026-12-03', 'verify approve (3 days)') returning id into r_app;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (ana, vac, '2026-12-10', '2026-12-11', 'verify reject (2 days)') returning id into r_rej;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (ana, vac, '2026-12-30', '2027-01-02', 'verify month boundary (4 days)') returning id into r_span;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (ana, unp, '2026-12-15', '2026-12-15', 'verify unpaid') returning id into r_unp;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (dan, vac, '2026-12-05', '2026-12-05', 'verify other team') returning id into r_dan;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason, is_deleted)
    values (ana, vac, '2026-12-06', '2026-12-06', 'verify soft-deleted', true) returning id into r_del;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (maria, vac, '2026-12-07', '2026-12-07', 'verify maria own') returning id into r_maria;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (ana, vac, '2026-12-20', '2026-12-21', 'verify missing balance row (2 days)') returning id into r_nobal;

  ---------------------------------------------------------------- AC1: approve
  res := public.decide_leave_request(maria, r_app, 'approve', null);
  if res.status is distinct from 'approved' or res.decided_by is distinct from maria or res.decided_at is null then
    raise exception 'VERIFY_FAILED AC1: approve did not set status/decided_by/decided_at';
  end if;
  select balance into bal from public.leave_balances where user_id = ana and leave_type_id = vac;
  if bal is distinct from 7 then raise exception 'VERIFY_FAILED AC1: balance should be 10 - 3 = 7, got %', bal; end if;
  select count(*) into n from public.audit_log where leave_request_id = r_app and action = 'approved' and actor_id = maria;
  if n <> 1 then raise exception 'VERIFY_FAILED AC1: expected exactly 1 approved audit row, got %', n; end if;

  ---------------------------------------------------------------- reject needs a reason
  foreach msg in array array[null, '', '   '] loop
    begin
      perform public.decide_leave_request(maria, r_rej, 'reject', msg);
      raise exception 'VERIFY_FAILED: reject without a reason was allowed';
    exception when others then
      if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
      if sqlerrm <> 'REASON_REQUIRED' then raise exception 'VERIFY_FAILED: expected REASON_REQUIRED, got %', sqlerrm; end if;
    end;
  end loop;
  select count(*) into n from public.leave_requests where id = r_rej and status = 'pending';
  if n <> 1 then raise exception 'VERIFY_FAILED: a rejected-without-reason request changed state'; end if;

  ---------------------------------------------------------------- AC2: reject
  res := public.decide_leave_request(maria, r_rej, 'reject', 'No cover that week');
  if res.status is distinct from 'rejected' or res.decision_reason is distinct from 'No cover that week' or res.decided_by is distinct from maria then
    raise exception 'VERIFY_FAILED AC2: reject did not set status/reason/decided_by';
  end if;
  select balance into bal from public.leave_balances where user_id = ana and leave_type_id = vac;
  if bal is distinct from 7 then raise exception 'VERIFY_FAILED AC2: rejecting changed the balance (now %)', bal; end if;
  select count(*) into n from public.audit_log where leave_request_id = r_rej and action = 'rejected' and actor_id = maria;
  if n <> 1 then raise exception 'VERIFY_FAILED AC2: expected exactly 1 rejected audit row, got %', n; end if;

  ---------------------------------------------------------------- exactly once
  begin
    perform public.decide_leave_request(maria, r_app, 'approve', null);
    raise exception 'VERIFY_FAILED: approving twice was allowed';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm <> 'NOT_PENDING' then raise exception 'VERIFY_FAILED: expected NOT_PENDING, got %', sqlerrm; end if;
  end;
  begin
    perform public.decide_leave_request(maria, r_rej, 'approve', null);
    raise exception 'VERIFY_FAILED: approving a rejected request was allowed';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm <> 'NOT_PENDING' then raise exception 'VERIFY_FAILED: expected NOT_PENDING, got %', sqlerrm; end if;
  end;
  select balance into bal from public.leave_balances where user_id = ana and leave_type_id = vac;
  if bal is distinct from 7 then raise exception 'VERIFY_FAILED: a repeated decision changed the balance (now %)', bal; end if;
  select count(*) into n from public.audit_log where leave_request_id = r_app;
  if n <> 1 then raise exception 'VERIFY_FAILED: a repeated decision wrote another audit row (% rows)', n; end if;

  ---------------------------------------------------------------- AC3: not a direct report
  select coalesce(sum(balance), 0) into total_before from public.leave_balances;
  begin
    perform public.decide_leave_request(maria, r_dan, 'approve', null);
    raise exception 'VERIFY_FAILED AC3: approving another team''s request was allowed';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm <> 'FORBIDDEN' then raise exception 'VERIFY_FAILED AC3: expected FORBIDDEN, got %', sqlerrm; end if;
  end;
  begin
    perform public.decide_leave_request(maria, r_dan, 'reject', 'not mine');
    raise exception 'VERIFY_FAILED AC3: rejecting another team''s request was allowed';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm <> 'FORBIDDEN' then raise exception 'VERIFY_FAILED AC3: expected FORBIDDEN, got %', sqlerrm; end if;
  end;
  select count(*) into n from public.leave_requests where id = r_dan and status = 'pending' and decided_by is null;
  if n <> 1 then raise exception 'VERIFY_FAILED AC3: the other team''s request was changed'; end if;
  select count(*) into n from public.audit_log where leave_request_id = r_dan;
  if n <> 0 then raise exception 'VERIFY_FAILED AC3: an audit row was written for the other team''s request'; end if;
  select coalesce(sum(balance), 0) into total_after from public.leave_balances;
  if total_after <> total_before then raise exception 'VERIFY_FAILED AC3: a balance changed (% -> %)', total_before, total_after; end if;
  -- ...and the request never appeared in her queue to begin with (TASK-013).
  select count(*) into n from public.team_leave_requests(maria) t where t.id = r_dan;
  if n <> 0 then raise exception 'VERIFY_FAILED AC3: the other team''s request is visible in Maria''s queue'; end if;

  ---------------------------------------------------------------- only managers decide
  begin
    perform public.decide_leave_request(ana, r_span, 'approve', null);
    raise exception 'VERIFY_FAILED: an employee decided a request';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm <> 'FORBIDDEN' then raise exception 'VERIFY_FAILED: expected FORBIDDEN for an employee, got %', sqlerrm; end if;
  end;
  -- An EMPLOYEE who is somebody's manager must still be refused: only the manager role may decide.
  update public.users set manager_id = ana where id = dan;
  begin
    perform public.decide_leave_request(ana, r_dan, 'approve', null);
    raise exception 'VERIFY_FAILED: an employee who manages someone decided their request';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm <> 'FORBIDDEN' then raise exception 'VERIFY_FAILED: expected FORBIDDEN for an employee-manager, got %', sqlerrm; end if;
  end;
  update public.users set manager_id = (select id from public.users where email = 'paolo@example.com') where id = dan;
  begin
    perform public.decide_leave_request(null, r_span, 'approve', null);
    raise exception 'VERIFY_FAILED: a null manager decided a request';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm <> 'FORBIDDEN' then raise exception 'VERIFY_FAILED: expected FORBIDDEN for a null manager, got %', sqlerrm; end if;
  end;

  ---------------------------------------------------------------- not found / soft-deleted / invalid
  foreach msg in array array['00000000-0000-4000-8000-000000000000', r_del::text] loop
    begin
      perform public.decide_leave_request(maria, msg::uuid, 'approve', null);
      raise exception 'VERIFY_FAILED: a missing or soft-deleted request was decided';
    exception when others then
      if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
      if sqlerrm <> 'NOT_FOUND' then raise exception 'VERIFY_FAILED: expected NOT_FOUND, got %', sqlerrm; end if;
    end;
  end loop;
  begin
    perform public.decide_leave_request(maria, r_span, 'maybe', null);
    raise exception 'VERIFY_FAILED: an invalid decision was accepted';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm <> 'INVALID_DECISION' then raise exception 'VERIFY_FAILED: expected INVALID_DECISION, got %', sqlerrm; end if;
  end;

  ---------------------------------------------------------------- Unpaid never touches a balance (US-08)
  select coalesce(sum(balance), 0) into total_before from public.leave_balances;
  res := public.decide_leave_request(maria, r_unp, 'approve', null);
  select coalesce(sum(balance), 0) into total_after from public.leave_balances;
  if res.status is distinct from 'approved' or total_after <> total_before then
    raise exception 'VERIFY_FAILED: approving Unpaid leave changed a balance (% -> %)', total_before, total_after;
  end if;
  select count(*) into n from public.leave_balances where user_id = ana and leave_type_id = unp;
  if n <> 0 then raise exception 'VERIFY_FAILED: a balance row was created for Unpaid'; end if;

  ---------------------------------------------------------------- inclusive days across a month boundary
  res := public.decide_leave_request(maria, r_span, 'approve', null);
  select balance into bal from public.leave_balances where user_id = ana and leave_type_id = vac;
  if bal is distinct from 3 then raise exception 'VERIFY_FAILED: 30 Dec to 2 Jan is 4 days, so 7 - 4 = 3, got %', bal; end if;

  ---------------------------------------------------------------- only that employee's own leave type moves
  select coalesce(sum(balance), 0) into total_before from public.leave_balances where not (user_id = ana and leave_type_id = vac);
  delete from public.leave_balances where user_id = ana and leave_type_id = vac;  -- no row yet
  res := public.decide_leave_request(maria, r_nobal, 'approve', null);
  select balance into bal from public.leave_balances where user_id = ana and leave_type_id = vac;
  if bal is distinct from -2 then raise exception 'VERIFY_FAILED: approving with no balance row should create -2, got %', bal; end if;
  select coalesce(sum(balance), 0) into total_after from public.leave_balances where not (user_id = ana and leave_type_id = vac);
  if total_after <> total_before then raise exception 'VERIFY_FAILED: another balance changed (% -> %)', total_before, total_after; end if;

  ---------------------------------------------------------------- AC1 (TASK-018): a decision never touches a sibling leave type
  -- Explicit starting balances (the seed only gives 0), compared row by row, not as a sum, so an
  -- offsetting error cannot hide.
  insert into public.leave_balances (user_id, leave_type_id, balance) values (ana, vac, 10)
    on conflict (user_id, leave_type_id) do update set balance = 10;
  insert into public.leave_balances (user_id, leave_type_id, balance) values (ana, sick, 8)
    on conflict (user_id, leave_type_id) do update set balance = 8;
  delete from public.leave_balances where user_id = ana and leave_type_id = unp;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (ana, sick, '2027-02-01', '2027-02-02', 'verify sick approve (2 days)') returning id into r_sick1;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (ana, sick, '2027-02-10', '2027-02-12', 'verify sick reject (3 days)') returning id into r_sick2;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (ana, vac, '2027-02-20', '2027-02-20', 'verify vacation after sick (1 day)') returning id into r_vac2;
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (ana, unp, '2027-03-01', '2027-03-05', 'verify unpaid with empty balances (5 days)') returning id into r_unp2;

  res := public.decide_leave_request(maria, r_sick1, 'approve', null);
  select balance into bal from public.leave_balances where user_id = ana and leave_type_id = sick;
  if bal is distinct from 6 then raise exception 'VERIFY_FAILED TASK-018 AC1: approving Sick should leave Sick at 8 - 2 = 6, got %', bal; end if;
  select balance into bal from public.leave_balances where user_id = ana and leave_type_id = vac;
  if bal is distinct from 10 then raise exception 'VERIFY_FAILED TASK-018 AC1: approving Sick changed Vacation (now %)', bal; end if;
  select count(*) into n from public.leave_balances where user_id = ana and leave_type_id = unp;
  if n <> 0 then raise exception 'VERIFY_FAILED TASK-018 AC1: approving Sick created an Unpaid balance row'; end if;

  res := public.decide_leave_request(maria, r_sick2, 'reject', 'verify reject');
  select balance into bal from public.leave_balances where user_id = ana and leave_type_id = sick;
  if bal is distinct from 6 then raise exception 'VERIFY_FAILED TASK-018 AC1: rejecting Sick changed Sick (now %)', bal; end if;
  select balance into bal from public.leave_balances where user_id = ana and leave_type_id = vac;
  if bal is distinct from 10 then raise exception 'VERIFY_FAILED TASK-018 AC1: rejecting Sick changed Vacation (now %)', bal; end if;

  res := public.decide_leave_request(maria, r_vac2, 'approve', null);
  select balance into bal from public.leave_balances where user_id = ana and leave_type_id = vac;
  if bal is distinct from 9 then raise exception 'VERIFY_FAILED TASK-018 AC1: approving Vacation should leave 10 - 1 = 9, got %', bal; end if;
  select balance into bal from public.leave_balances where user_id = ana and leave_type_id = sick;
  if bal is distinct from 6 then raise exception 'VERIFY_FAILED TASK-018 AC1: approving Vacation changed Sick (now %)', bal; end if;

  ---------------------------------------------------------------- AC2 (TASK-018): Unpaid is never blocked by a balance
  update public.leave_balances set balance = 0 where user_id = ana and leave_type_id in (vac, sick);
  res := public.decide_leave_request(maria, r_unp2, 'approve', null);
  if res.status is distinct from 'approved' then raise exception 'VERIFY_FAILED TASK-018 AC2: Unpaid was not approved with empty balances'; end if;
  select count(*) into n from public.leave_balances
    where user_id = ana and ((leave_type_id = unp) or (leave_type_id in (vac, sick) and balance <> 0));
  if n <> 0 then raise exception 'VERIFY_FAILED TASK-018 AC2: approving Unpaid changed or created a balance'; end if;

  ---------------------------------------------------------------- nobody is their own manager
  begin
    update public.users set manager_id = id where id = maria;
    raise exception 'VERIFY_FAILED: a user was allowed to be their own manager';
  exception when check_violation then
    null;  -- expected
  end;

  -- Belt and braces: even if the constraint were gone, the function refuses to decide your own request.
  alter table public.users drop constraint users_not_own_manager;
  update public.users set manager_id = id where id = maria;
  begin
    perform public.decide_leave_request(maria, r_maria, 'approve', null);
    raise exception 'VERIFY_FAILED: a manager approved their own request';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm <> 'FORBIDDEN' then raise exception 'VERIFY_FAILED: expected FORBIDDEN for self-approval, got %', sqlerrm; end if;
  end;

  raise exception 'VERIFY_OK: AC1 approve, AC2 reject, AC3 scope, exactly-once, roles, Unpaid, sibling balances, day rule, self-approval; rolled back';
end;
$$;
