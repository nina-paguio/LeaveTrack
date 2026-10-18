-- TASK-017: monthly leave accrual (US-07, BR-06). See docs/arch-docs/ADR-LeaveTrack-E002-Accrual-Idempotency.md.
--
-- run_monthly_accrual(p_month) adds each policy's accrual_per_month to the matching balance, once per
-- month. Idempotent: every balance row carries last_accrued_month, and a row is only updated if that
-- marker is null or EARLIER than the month being run. A repeat run in the same month therefore changes
-- nothing, and an earlier month can never run after a later one. A user who gets a policy mid-month has
-- no balance row yet, so the upsert creates it (a full month's accrual: no pro-rating rule exists).
-- Only leave types that track a balance accrue (Unpaid has no balance, BR-07).
-- The app passes the first day of the current Asia/Manila month; this function does not guess the zone.
-- Atomic (one transaction) and serialised by an advisory lock. Only service_role may execute it.

alter table leave_balances add column last_accrued_month date;

-- One row per invocation (including no-op repeats): what ran, for which month, and what it changed.
create table accrual_runs (
  id            uuid primary key default gen_random_uuid(),
  month         date not null check (extract(day from month) = 1),
  ran_at        timestamptz not null default now(),
  rows_accrued  int not null,
  rows_skipped  int not null
);
create index accrual_runs_month_idx on accrual_runs (month);

alter table accrual_runs enable row level security;
revoke all on accrual_runs from anon, authenticated;

-- Raises INVALID_MONTH unless p_month is the first day of a month.
create function run_monthly_accrual(p_month date)
returns table (run_month date, accrued int, skipped int, already_ran boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_accrued int;
  v_total   int;
begin
  if p_month is null or extract(day from p_month) <> 1 then
    raise exception 'INVALID_MONTH';
  end if;

  -- Two overlapping runs (e.g. a duplicate cron delivery) take turns instead of both adding.
  perform pg_advisory_xact_lock(hashtext('leavetrack.monthly_accrual'));

  select count(*) into v_total
    from public.leave_policies p
    join public.leave_types t on t.id = p.leave_type_id
   where t.tracks_balance;

  with upserted as (
    insert into public.leave_balances as b (user_id, leave_type_id, balance, last_accrued_month)
    select p.user_id, p.leave_type_id, p.accrual_per_month, p_month
      from public.leave_policies p
      join public.leave_types t on t.id = p.leave_type_id
     where t.tracks_balance
    on conflict (user_id, leave_type_id) do update
       set balance = b.balance + excluded.balance,
           last_accrued_month = excluded.last_accrued_month,
           updated_at = now()
     where b.last_accrued_month is null or b.last_accrued_month < excluded.last_accrued_month
    returning 1
  )
  select count(*) into v_accrued from upserted;

  insert into public.accrual_runs (month, rows_accrued, rows_skipped)
    values (p_month, v_accrued, v_total - v_accrued);

  return query select p_month, v_accrued, v_total - v_accrued, (v_accrued = 0 and v_total > 0);
end;
$$;

revoke all on function run_monthly_accrual(date) from public, anon, authenticated;
grant execute on function run_monthly_accrual(date) to service_role;
