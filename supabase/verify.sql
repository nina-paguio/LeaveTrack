-- TASK-010 verification. Read-only: the only write happens inside a transaction that is rolled back.
-- Every check returns a row with ok = true when it passes.

-- AC2: all 6 tables exist.
select 'AC2 tables exist' as check,
       (select count(*) from information_schema.tables
         where table_schema = 'public'
           and table_name in ('users','leave_types','leave_policies','leave_balances','leave_requests','audit_log')) = 6 as ok;

-- AC2: foreign keys match the arch doc (10 FKs: users.manager_id; policies 2; balances 2;
-- requests user/type/decided_by 3; audit_log request/actor 2).
select 'AC2 foreign keys' as check,
       (select count(*) from information_schema.table_constraints
         where table_schema = 'public' and constraint_type = 'FOREIGN KEY') = 10 as ok;

-- AC3: leave_types holds exactly Vacation, Sick, Unpaid.
select 'AC3 leave_types seeded' as check,
       (select count(*) from leave_types) = 3
       and (select count(*) from leave_types where name in ('Vacation','Sick','Unpaid')) = 3 as ok;

-- AC4: is_deleted defaults to false.
select 'AC4 is_deleted default false' as check,
       (select column_default from information_schema.columns
         where table_schema = 'public' and table_name = 'leave_requests' and column_name = 'is_deleted') = 'false' as ok;

-- AC4: delete and truncate are blocked by triggers on both retained tables.
-- Uses pg_trigger: information_schema.triggers does not list TRUNCATE triggers.
select 'AC4 no-delete/truncate triggers' as check,
       (select count(*) from pg_trigger
         where not tgisinternal
           and tgname in ('leave_requests_no_delete','leave_requests_no_truncate',
                          'audit_log_no_delete','audit_log_no_truncate')) = 4 as ok;

-- Security: RLS is enabled on every table.
select 'RLS enabled on all 6 tables' as check,
       (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
           and c.relname in ('users','leave_types','leave_policies','leave_balances','leave_requests','audit_log')) = 6 as ok;

-- Security: anon and authenticated hold no table privileges.
select 'anon/authenticated have no privileges' as check,
       (select count(*) from information_schema.role_table_grants
         where table_schema = 'public' and grantee in ('anon','authenticated')
           and table_name in ('users','leave_types','leave_policies','leave_balances','leave_requests','audit_log')) = 0 as ok;

-- TASK-011: submit_leave_request exists and only the server-side service_role may execute it.
select 'TASK-011 submit_leave_request exists' as check,
       to_regprocedure('public.submit_leave_request(uuid,uuid,date,date,text)') is not null as ok;

select 'TASK-011 anon/authenticated cannot execute it' as check,
       not has_function_privilege('anon', 'public.submit_leave_request(uuid,uuid,date,date,text)', 'execute')
       and not has_function_privilege('authenticated', 'public.submit_leave_request(uuid,uuid,date,date,text)', 'execute')
       and has_function_privilege('service_role', 'public.submit_leave_request(uuid,uuid,date,date,text)', 'execute') as ok;

-- TASK-013: team_leave_requests exists and only the server-side service_role may execute it.
select 'TASK-013 team_leave_requests exists' as check,
       to_regprocedure('public.team_leave_requests(uuid)') is not null as ok;

select 'TASK-013 anon/authenticated cannot execute it' as check,
       not has_function_privilege('anon', 'public.team_leave_requests(uuid)', 'execute')
       and not has_function_privilege('authenticated', 'public.team_leave_requests(uuid)', 'execute')
       and has_function_privilege('service_role', 'public.team_leave_requests(uuid)', 'execute') as ok;

-- TASK-014: decide_leave_request exists, only service_role may execute it, and nobody can be their own manager.
select 'TASK-014 decide_leave_request exists' as check,
       to_regprocedure('public.decide_leave_request(uuid,uuid,text,text)') is not null as ok;

select 'TASK-014 anon/authenticated cannot execute it' as check,
       not has_function_privilege('anon', 'public.decide_leave_request(uuid,uuid,text,text)', 'execute')
       and not has_function_privilege('authenticated', 'public.decide_leave_request(uuid,uuid,text,text)', 'execute')
       and has_function_privilege('service_role', 'public.decide_leave_request(uuid,uuid,text,text)', 'execute') as ok;

select 'TASK-014 users_not_own_manager constraint' as check,
       exists (select 1 from pg_constraint where conname = 'users_not_own_manager' and contype = 'c') as ok;

select 'TASK-014 decision_reason column exists' as check,
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'leave_requests' and column_name = 'decision_reason') as ok;

-- TASK-015: employee_audit_report exists and only the server-side service_role may execute it.
select 'TASK-015 employee_audit_report exists' as check,
       to_regprocedure('public.employee_audit_report(uuid,date,date)') is not null as ok;

select 'TASK-015 anon/authenticated cannot execute it' as check,
       not has_function_privilege('anon', 'public.employee_audit_report(uuid,date,date)', 'execute')
       and not has_function_privilege('authenticated', 'public.employee_audit_report(uuid,date,date)', 'execute')
       and has_function_privilege('service_role', 'public.employee_audit_report(uuid,date,date)', 'execute') as ok;

-- TASK-017: run_monthly_accrual exists and only service_role may execute it; accrual_runs is locked down.
select 'TASK-017 run_monthly_accrual exists' as check,
       to_regprocedure('public.run_monthly_accrual(date)') is not null as ok;

select 'TASK-017 anon/authenticated cannot execute it' as check,
       not has_function_privilege('anon', 'public.run_monthly_accrual(date)', 'execute')
       and not has_function_privilege('authenticated', 'public.run_monthly_accrual(date)', 'execute')
       and has_function_privilege('service_role', 'public.run_monthly_accrual(date)', 'execute') as ok;

select 'TASK-017 accrual_runs has RLS and no anon/authenticated privileges' as check,
       (select relrowsecurity from pg_class where oid = 'public.accrual_runs'::regclass)
       and (select count(*) from information_schema.role_table_grants
             where table_schema = 'public' and table_name = 'accrual_runs'
               and grantee in ('anon','authenticated')) = 0 as ok;

select 'TASK-017 leave_balances.last_accrued_month exists' as check,
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'leave_balances'
                  and column_name = 'last_accrued_month') as ok;

-- AC4 behaviour: a real DELETE and a TRUNCATE must both raise. This is ONE statement that always ends by
-- raising VERIFY_OK, which aborts it, so the rows it inserts are rolled back and nothing persists.
-- Expected result: an error whose message starts with VERIFY_OK (anything else is a failure).
do $$
declare
  uid uuid;
  tid uuid;
  rid uuid;
begin
  insert into users (name, email, role)
    values ('verify', 'verify-' || gen_random_uuid() || '@example.invalid', 'employee') returning id into uid;
  select id into tid from leave_types where name = 'Vacation';
  insert into leave_requests (user_id, leave_type_id, start_date, end_date, reason)
    values (uid, tid, current_date, current_date, 'verify') returning id into rid;

  begin
    delete from leave_requests where id = rid;
    raise exception 'VERIFY_FAILED: delete was allowed';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
  end;

  begin
    truncate leave_requests;
    raise exception 'VERIFY_FAILED: truncate was allowed';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
  end;

  raise exception 'VERIFY_OK: delete and truncate are blocked (rolled back)';
end;
$$;
