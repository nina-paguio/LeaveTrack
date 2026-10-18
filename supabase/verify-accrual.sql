-- TASK-017 test for run_monthly_accrual(). ONE statement that always ends by raising, so every balance
-- change, test user and log row is rolled back and nothing persists.
-- Expected result: an error whose message starts with VERIFY_OK.
--
-- AC1: running the job once raises every balance by exactly its policy's accrual_per_month.
-- AC2: running it again in the same month is a no-op.
-- Months in 2099 are used so they are later than any month a real run could have recorded.
do $$
declare
  maria uuid; vac uuid; sick uuid; unp uuid;
  t1 uuid; t2 uuid; t3 uuid;
  m1 date := date '2099-01-01';
  m2 date := date '2099-02-01';
  res record; n int; bal numeric; total int; bad int;
begin
  select id into maria from public.users where email = 'maria@example.com';
  select id into vac  from public.leave_types where name = 'Vacation';
  select id into sick from public.leave_types where name = 'Sick';
  select id into unp  from public.leave_types where name = 'Unpaid';
  if maria is null or vac is null or sick is null or unp is null then
    raise exception 'VERIFY_FAILED: seed data (seed.sql + seed.dev.sql) is missing';
  end if;

  -- t1: Vacation balance 10 and NO Sick row (must be created). t2: a NEGATIVE Vacation balance.
  -- t3: has a policy on Unpaid, which tracks no balance, so it must be ignored.
  insert into public.users (name, email, role, manager_id)
    values ('Accrual One', 'acc1-' || gen_random_uuid() || '@example.invalid', 'employee', maria) returning id into t1;
  insert into public.users (name, email, role, manager_id)
    values ('Accrual Two', 'acc2-' || gen_random_uuid() || '@example.invalid', 'employee', maria) returning id into t2;
  insert into public.users (name, email, role, manager_id)
    values ('Accrual Three', 'acc3-' || gen_random_uuid() || '@example.invalid', 'employee', maria) returning id into t3;
  insert into public.leave_policies (user_id, leave_type_id, accrual_per_month) values
    (t1, vac, 1.25), (t1, sick, 0.50), (t2, vac, 1.25), (t3, unp, 9.99);
  insert into public.leave_balances (user_id, leave_type_id, balance) values (t1, vac, 10), (t2, vac, -3);

  create temporary table lt_snap on commit drop as
    select user_id, leave_type_id, balance from public.leave_balances;
  select count(*) into total from public.leave_policies p
    join public.leave_types t on t.id = p.leave_type_id where t.tracks_balance;

  ---------------------------------------------------------------- AC1: first run for the month
  select * into res from public.run_monthly_accrual(m1);
  if res.run_month is distinct from m1 or res.accrued is distinct from total
     or res.skipped is distinct from 0 or res.already_ran is distinct from false then
    raise exception 'VERIFY_FAILED AC1: first run returned (%, %, %, %), expected (%, %, 0, false)',
      res.run_month, res.accrued, res.skipped, res.already_ran, m1, total;
  end if;

  -- every tracked policy: new balance = old balance + exactly accrual_per_month, and the month is recorded
  select count(*) into bad
    from public.leave_policies p
    join public.leave_types t on t.id = p.leave_type_id and t.tracks_balance
    left join lt_snap s on s.user_id = p.user_id and s.leave_type_id = p.leave_type_id
    left join public.leave_balances b on b.user_id = p.user_id and b.leave_type_id = p.leave_type_id
   where b.balance is distinct from coalesce(s.balance, 0) + p.accrual_per_month
      or b.last_accrued_month is distinct from m1;
  if bad <> 0 then raise exception 'VERIFY_FAILED AC1: % balance(s) did not rise by exactly their accrual_per_month', bad; end if;

  select balance into bal from public.leave_balances where user_id = t1 and leave_type_id = vac;
  if bal is distinct from 11.25 then raise exception 'VERIFY_FAILED AC1: 10 + 1.25 should be 11.25, got %', bal; end if;
  select balance into bal from public.leave_balances where user_id = t1 and leave_type_id = sick;
  if bal is distinct from 0.50 then raise exception 'VERIFY_FAILED AC1: a missing Sick row should be created at 0.50, got %', bal; end if;
  select balance into bal from public.leave_balances where user_id = t2 and leave_type_id = vac;
  if bal is distinct from -1.75 then raise exception 'VERIFY_FAILED AC1: a negative balance -3 + 1.25 should be -1.75, got %', bal; end if;

  -- Unpaid tracks no balance: nothing is created or changed for it
  select count(*) into n from public.leave_balances where user_id = t3;
  if n <> 0 then raise exception 'VERIFY_FAILED: a balance was created for a type that tracks none (Unpaid)'; end if;
  select count(*) into n from public.leave_balances where leave_type_id = unp;
  if n <> 0 then raise exception 'VERIFY_FAILED: an Unpaid balance row exists'; end if;

  ---------------------------------------------------------------- AC2: same month again is a no-op
  drop table lt_snap;
  create temporary table lt_snap on commit drop as
    select user_id, leave_type_id, balance, last_accrued_month, updated_at from public.leave_balances;

  select * into res from public.run_monthly_accrual(m1);
  if res.accrued is distinct from 0 or res.skipped is distinct from total or res.already_ran is distinct from true then
    raise exception 'VERIFY_FAILED AC2: repeat run returned (accrued %, skipped %, already_ran %), expected (0, %, true)',
      res.accrued, res.skipped, res.already_ran, total;
  end if;
  select count(*) into bad
    from public.leave_balances b
    join lt_snap s on s.user_id = b.user_id and s.leave_type_id = b.leave_type_id
   where b.balance is distinct from s.balance
      or b.last_accrued_month is distinct from s.last_accrued_month
      or b.updated_at is distinct from s.updated_at;
  if bad <> 0 then raise exception 'VERIFY_FAILED AC2: a repeat run in the same month changed % balance row(s)', bad; end if;
  select count(*) into n from public.leave_balances;
  if n <> (select count(*) from lt_snap) then raise exception 'VERIFY_FAILED AC2: a repeat run added balance rows'; end if;

  ---------------------------------------------------------------- the marker is per row, not a global switch
  select * into res from public.run_monthly_accrual(m2);
  if res.accrued is distinct from total then
    raise exception 'VERIFY_FAILED: the next month should accrue again (accrued %, expected %)', res.accrued, total;
  end if;
  select balance into bal from public.leave_balances where user_id = t1 and leave_type_id = vac;
  if bal is distinct from 12.50 then raise exception 'VERIFY_FAILED: 11.25 + 1.25 should be 12.50, got %', bal; end if;

  -- an earlier month never runs after a later one
  select * into res from public.run_monthly_accrual(m1);
  if res.accrued is distinct from 0 then
    raise exception 'VERIFY_FAILED: an earlier month accrued % row(s) after a later month ran', res.accrued;
  end if;
  select balance into bal from public.leave_balances where user_id = t1 and leave_type_id = vac;
  if bal is distinct from 12.50 then raise exception 'VERIFY_FAILED: an earlier month changed a balance (now %)', bal; end if;

  ---------------------------------------------------------------- the month must be the first of a month
  begin
    perform public.run_monthly_accrual(date '2099-03-15');
    raise exception 'VERIFY_FAILED: a mid-month date was accepted';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm <> 'INVALID_MONTH' then raise exception 'VERIFY_FAILED: expected INVALID_MONTH, got %', sqlerrm; end if;
  end;
  begin
    perform public.run_monthly_accrual(null);
    raise exception 'VERIFY_FAILED: a null month was accepted';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm <> 'INVALID_MONTH' then raise exception 'VERIFY_FAILED: expected INVALID_MONTH for null, got %', sqlerrm; end if;
  end;

  ---------------------------------------------------------------- every invocation is logged
  select count(*) into n from public.accrual_runs where month = m1;
  if n <> 3 then raise exception 'VERIFY_FAILED: expected 3 logged runs for the first month (first, repeat, earlier-after-later), got %', n; end if;
  select count(*) into n from public.accrual_runs where month = m2;
  if n <> 1 then raise exception 'VERIFY_FAILED: expected 1 logged run for the second month, got %', n; end if;
  select count(*) into n from public.accrual_runs where month = m1 and rows_accrued = total and rows_skipped = 0;
  if n <> 1 then raise exception 'VERIFY_FAILED: the first run of the month should log all % rows as accrued', total; end if;
  select count(*) into n from public.accrual_runs where month = m1 and rows_accrued = 0 and rows_skipped = total;
  if n <> 2 then raise exception 'VERIFY_FAILED: the two no-op runs should log 0 accrued / % skipped', total; end if;

  raise exception 'VERIFY_OK: AC1 exact amounts, AC2 same-month no-op, per-row marker, bad months refused, runs logged; rolled back';
end;
$$;
