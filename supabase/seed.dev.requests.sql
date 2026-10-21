-- DEV ONLY. Sample leave requests so lists, balances and the audit report have something to show.
-- Never run this against production. Run after seed.sql and seed.dev.sql.
--
-- Goes through submit_leave_request() and decide_leave_request(), the same functions the app uses, so the
-- audit rows, notifications and balance changes are exactly what the app would have written.
-- Idempotent: does nothing if any leave request already exists.

do $$
declare
  rec     record;
  req     public.leave_requests;
  emp     uuid;
  mgr     uuid;
  lt      uuid;
begin
  if exists (select 1 from public.leave_requests) then
    raise notice 'seed.dev.requests: leave requests already exist, skipped';
    return;
  end if;

  -- Starting balances, so the approvals below leave sensible numbers (not everyone at zero).
  update public.leave_balances b
     set balance = case t.name when 'Vacation' then 12 else 6 end
    from public.leave_types t
   where t.id = b.leave_type_id and t.tracks_balance;

  -- 20 requests: 10 approved, 3 rejected, 7 pending. Offsets are days from today.
  for rec in
    select * from (values
      -- employee,            type,       start, end, reason,                         decision,  decision reason
      ('ana@example.com',   'Vacation', -40, -38, 'Family trip to Baguio',            'approve', null),
      ('ana@example.com',   'Sick',     -20, -20, 'Fever',                            'approve', null),
      ('ana@example.com',   'Vacation',  14,  16, 'Long weekend',                     null,      null),
      ('ben@example.com',   'Vacation', -60, -56, 'Island holiday',                   'approve', null),
      ('ben@example.com',   'Unpaid',   -10,  -9, 'Personal errand',                  'approve', null),
      ('ben@example.com',   'Sick',       3,   3, 'Dental appointment',               null,      null),
      ('carla@example.com', 'Vacation', -30, -28, 'Wedding in the province',          'reject',  'Team deadline that week'),
      ('carla@example.com', 'Sick',     -5,  -4, 'Flu',                               'approve', null),
      ('carla@example.com', 'Vacation',  21,  25, 'Visiting relatives',               null,      null),
      ('dan@example.com',   'Vacation', -45, -43, 'Moving house',                     'approve', null),
      ('dan@example.com',   'Sick',     -12, -12, 'Migraine',                         'approve', null),
      ('dan@example.com',   'Vacation',   7,   9, 'Rest week',                        null,      null),
      ('ella@example.com',  'Vacation', -25, -21, 'Beach trip',                       'reject',  'Overlaps with the release'),
      ('ella@example.com',  'Sick',      -2,  -1, 'Stomach ache',                     'approve', null),
      ('ella@example.com',  'Unpaid',    30,  32, 'Study leave',                      null,      null),
      ('faye@example.com',  'Vacation', -15, -13, 'Anniversary trip',                 'approve', null),
      ('faye@example.com',  'Sick',       1,   2, 'Medical check-up',                 null,      null),
      ('gio@example.com',   'Vacation', -50, -48, 'Concert out of town',              'reject',  'Not enough cover'),
      ('gio@example.com',   'Sick',      -8,  -8, 'Cold',                             'approve', null),
      ('gio@example.com',   'Vacation',  18,  19, 'Family event',                     null,      null)
    ) as v (employee, leave_type, start_off, end_off, reason, decision, decision_reason)
  loop
    select id, manager_id into emp, mgr from public.users where email = rec.employee;
    select id into lt from public.leave_types where name = rec.leave_type;

    req := public.submit_leave_request(
      emp, lt, current_date + rec.start_off, current_date + rec.end_off, rec.reason
    );
    if rec.decision is not null then
      perform public.decide_leave_request(mgr, req.id, rec.decision, rec.decision_reason);
    end if;
  end loop;
end
$$;
