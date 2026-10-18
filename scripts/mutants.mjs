// Mutation targets for the security-critical SQL functions. Each mutant is a deliberately broken copy
// of the function; the matching verify-*.sql must report VERIFY_FAILED for every one. A mutant whose
// replacement text no longer matches the migration is reported as SKIP (the migration changed:
// update the mutant). Run: node scripts/mutate-sql.mjs decide|audit|team|all

export const targets = {
  team: {
    migration: "supabase/migrations/0003_team_leave_requests.sql",
    fn: "team_leave_requests",
    test: "supabase/verify-team.sql",
    mutants: {
      "T1 no manager filter (leaks every team)": (f) =>
        f.replace(
          "where u.manager_id = p_manager_id\n    and not r.is_deleted",
          "where not r.is_deleted",
        ),
      "T2 soft-deleted rows included": (f) =>
        f.replace(
          "where u.manager_id = p_manager_id\n    and not r.is_deleted",
          "where u.manager_id = p_manager_id",
        ),
      "T3 filters on the employee instead of their manager": (f) =>
        f.replace(
          "where u.manager_id = p_manager_id\n    and not r.is_deleted",
          "where u.id = p_manager_id and not r.is_deleted",
        ),
    },
  },

  decide: {
    migration: "supabase/migrations/0004_decide_leave_request.sql",
    fn: "decide_leave_request",
    test: "supabase/verify-decide.sql",
    mutants: {
      "D1 no scope check (any manager can decide anyone's request)": (f) =>
        f.replace(
          "if r.user_id = p_manager_id or owner_manager is null or owner_manager <> p_manager_id then",
          "if false then",
        ),
      "D2 no exactly-once check (can decide twice)": (f) =>
        f.replace("if r.status <> 'pending' then", "if false then"),
      "D3 approve never changes the balance": (f) => f.replace("if tracks then", "if false then"),
      "D4 reject also spends balance": (f) =>
        f.replace(
          "if p_decision = 'approve' then\n    select tracks_balance",
          "if true then\n    select tracks_balance",
        ),
      "D5 no audit row written": (f) =>
        f.replace(/insert into public\.audit_log[\s\S]*?\);\n/, "null;\n"),
      "D6 a manager may decide their own request": (f) =>
        f.replace("r.user_id = p_manager_id or ", ""),
      "D7 day count off by one": (f) =>
        f.replace(
          "days := (r.end_date - r.start_date) + 1;",
          "days := (r.end_date - r.start_date);",
        ),
      "D8 no role check (null or non-manager caller)": (f) =>
        f.replace(
          "if p_manager_id is null or manager_role is distinct from 'manager' then",
          "if false then",
        ),
      "D9 Unpaid spends a balance": (f) => f.replace("if tracks then", "if true then"),
      "D10 reject without a reason is accepted": (f) =>
        f.replace(
          "if p_decision = 'reject' and (p_reason is null or btrim(p_reason) = '') then",
          "if false then",
        ),
      "D12 the rejection reason is never stored": (f) =>
        f.replace("decision_reason = nullif(btrim(p_reason), '')", "decision_reason = null"),
      "D13 approve spends a sibling leave type": (f) =>
        f.replace(
          "values (r.user_id, r.leave_type_id, -days)",
          "values (r.user_id, (select id from public.leave_types where tracks_balance and id <> r.leave_type_id limit 1), -days)",
        ),
      "D14 approve spends every leave type the employee has": (f) =>
        f.replace(
          /insert into public\.leave_balances[\s\S]*?updated_at = now\(\);/,
          "update public.leave_balances set balance = balance - days, updated_at = now() where user_id = r.user_id;",
        ),
      "D15 approving Sick spends Vacation instead": (f) =>
        f.replace(
          "values (r.user_id, r.leave_type_id, -days)",
          "values (r.user_id, case when r.leave_type_id = (select id from public.leave_types where name = 'Sick') then (select id from public.leave_types where name = 'Vacation') else r.leave_type_id end, -days)",
        ),
      "D11 soft-deleted requests can be decided": (f) =>
        f.replace(
          "where id = p_request_id and not is_deleted for update",
          "where id = p_request_id for update",
        ),
    },
  },

  // The advisory lock (two overlapping runs take turns) cannot be mutation-tested here: a single
  // rolled-back session never has a concurrent run. It is reviewed, not tested.
  accrual: {
    migration: "supabase/migrations/0006_monthly_accrual.sql",
    fn: "run_monthly_accrual",
    test: "supabase/verify-accrual.sql",
    mutants: {
      "X1 no idempotency marker check (a repeat accrues again)": (f) =>
        f.replace(
          "     where b.last_accrued_month is null or b.last_accrued_month < excluded.last_accrued_month\n",
          "",
        ),
      "X2 same month allowed twice (< becomes <=)": (f) =>
        f.replace(
          "b.last_accrued_month < excluded.last_accrued_month",
          "b.last_accrued_month <= excluded.last_accrued_month",
        ),
      "X3 untracked types accrue too (Unpaid)": (f) =>
        f.split("where t.tracks_balance").join("where true"),
      "X4 the policy rate is ignored (adds 1)": (f) =>
        f.replace(
          "select p.user_id, p.leave_type_id, p.accrual_per_month, p_month",
          "select p.user_id, p.leave_type_id, 1, p_month",
        ),
      "X5 missing balance rows are not created": (f) =>
        f.replace(
          "     where t.tracks_balance\n    on conflict",
          "     where t.tracks_balance and exists (select 1 from public.leave_balances x where x.user_id = p.user_id and x.leave_type_id = p.leave_type_id)\n    on conflict",
        ),
      "X6 the month marker is never advanced": (f) =>
        f.replace(
          "last_accrued_month = excluded.last_accrued_month,\n           updated_at",
          "last_accrued_month = b.last_accrued_month,\n           updated_at",
        ),
      "X7 an earlier month can run after a later one (< becomes <>)": (f) =>
        f.replace("b.last_accrued_month < excluded", "b.last_accrued_month <> excluded"),
      "X8 the month is not validated": (f) =>
        f.replace("if p_month is null or extract(day from p_month) <> 1 then", "if false then"),
      "X9 runs are not logged": (f) =>
        f.replace(/insert into public\.accrual_runs[\s\S]*?\);\n/, "null;\n"),
      "X10 skipped is reported as 0": (f) =>
        f.replace(
          "return query select p_month, v_accrued, v_total - v_accrued,",
          "return query select p_month, v_accrued, 0,",
        ),
      "X11 already_ran is never true": (f) =>
        f.replace("(v_accrued = 0 and v_total > 0);", "false;"),
      "X12 the balance is overwritten instead of added to": (f) =>
        f.replace("set balance = b.balance + excluded.balance,", "set balance = excluded.balance,"),
    },
  },

  audit: {
    migration: "supabase/migrations/0005_employee_audit_report.sql",
    fn: "employee_audit_report",
    test: "supabase/verify-audit.sql",
    mutants: {
      "A1 no employee filter (reports everyone's history)": (f) =>
        f.replace(
          "where r.user_id = p_user_id\n    and not r.is_deleted",
          "where not r.is_deleted",
        ),
      "A2 soft-deleted requests included": (f) =>
        f.replace(
          "where r.user_id = p_user_id\n    and not r.is_deleted",
          "where r.user_id = p_user_id",
        ),
      "A3 silently drops requests older than 3 years": (f) =>
        f.replace(
          "and (p_from is null or r.end_date >= p_from)",
          "and r.end_date > (now() - interval '3 years')::date\n    and (p_from is null or r.end_date >= p_from)",
        ),
      "A4 range is not an overlap (start >= from)": (f) =>
        f.replace("r.end_date >= p_from", "r.start_date >= p_from"),
      "A5 decision-maker name never joins": (f) =>
        f.replace(
          "left join public.users d on d.id = r.decided_by",
          "left join public.users d on false",
        ),
      "A6 decision time dropped": (f) =>
        f.replace(
          "d.name, r.decided_at, r.decision_reason",
          "d.name, null::timestamptz, r.decision_reason",
        ),
      "A7 range end is exclusive": (f) => f.replace("r.start_date <= p_to", "r.start_date < p_to"),
      "A9 leaks the employee's own free-text reason": (f) => {
        // The return type changes, so the real function must be dropped first (all inside the test's rolled-back transaction).
        const widened = f
          .replace(
            "decision_reason  text,\n  created_at       timestamptz\n)",
            "decision_reason  text,\n  created_at       timestamptz,\n  reason           text\n)",
          )
          .replace("r.decision_reason, r.created_at", "r.decision_reason, r.created_at, r.reason");
        return widened === f
          ? f
          : "drop function if exists public.employee_audit_report(uuid, date, date);\n" + widened;
      },
      "A8 inner join drops undecided (pending) requests": (f) =>
        f.replace(
          "left join public.users d on d.id = r.decided_by",
          "join public.users d on d.id = r.decided_by",
        ),
    },
  },
};
