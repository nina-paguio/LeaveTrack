-- Test for the notification writes in submit_leave_request / decide_leave_request and the three read /
-- write functions of migration 0007. ONE statement that always ends by raising, so every row it creates
-- is rolled back and nothing persists (leave_requests and audit_log cannot be deleted, so test rows
-- must never be committed).
-- Expected result: an error whose message starts with VERIFY_OK. Anything else is a failure.
do $$
declare
  maria uuid; ana uuid; dan uuid; paolo uuid; vac uuid;
  r1 uuid; r2 uuid; r3 uuid; r_dan uuid; r_maria uuid;
  req public.leave_requests;
  n int; a int; b int; c int; d int; who text; why text;
begin
  select id into maria from public.users where email = 'maria@example.com';
  select id into ana   from public.users where email = 'ana@example.com';
  select id into dan   from public.users where email = 'dan@example.com';
  select id into paolo from public.users where email = 'paolo@example.com';
  select id into vac   from public.leave_types where name = 'Vacation';
  if maria is null or ana is null or dan is null or paolo is null or vac is null then
    raise exception 'VERIFY_FAILED: seed data (seed.sql + seed.dev.sql) is missing';
  end if;
  if (select manager_id from public.users where id = ana) is distinct from maria
     or (select manager_id from public.users where id = dan) is distinct from paolo
     or (select manager_id from public.users where id = maria) is not null then
    raise exception 'VERIFY_FAILED: seed reporting lines changed (ana->maria, dan->paolo, maria has no manager)';
  end if;

  ---------------------------------------------------------------- submit notifies the manager only
  req := public.submit_leave_request(ana, vac, '2026-12-01', '2026-12-02', 'verify notify submit');
  r1 := req.id;
  select count(*) into n from public.notifications where leave_request_id = r1;
  if n <> 1 then raise exception 'VERIFY_FAILED: submit should create exactly 1 notification, got %', n; end if;
  select count(*) into n from public.notifications
    where leave_request_id = r1 and user_id = maria and kind = 'request_submitted';
  if n <> 1 then raise exception 'VERIFY_FAILED: the manager (maria) was not notified of the submission'; end if;

  -- another team's request notifies that team's manager, never maria
  req := public.submit_leave_request(dan, vac, '2026-12-05', '2026-12-05', 'verify other team');
  r_dan := req.id;
  select count(*) into n from public.notifications
    where leave_request_id = r_dan and user_id = paolo and kind = 'request_submitted';
  if n <> 1 then raise exception 'VERIFY_FAILED: dan''s manager (paolo) was not notified'; end if;
  select count(*) into n from public.notifications where leave_request_id = r_dan and user_id <> paolo;
  if n <> 0 then raise exception 'VERIFY_FAILED: someone other than dan''s manager was notified'; end if;

  -- a user with no manager can still submit; nobody is notified and nothing errors
  begin
    req := public.submit_leave_request(maria, vac, '2026-12-07', '2026-12-07', 'verify no manager');
    r_maria := req.id;
  exception when others then
    raise exception 'VERIFY_FAILED: a user with no manager could not submit: %', sqlerrm;
  end;
  select count(*) into n from public.notifications where leave_request_id = r_maria;
  if n <> 0 then raise exception 'VERIFY_FAILED: a request with no manager produced % notification(s)', n; end if;

  ---------------------------------------------------------------- approve notifies the employee only
  req := public.decide_leave_request(maria, r1, 'approve', null);
  select count(*) into n from public.notifications where leave_request_id = r1;
  if n <> 2 then raise exception 'VERIFY_FAILED: after approve, request 1 should have 2 notifications, got %', n; end if;
  select count(*) into n from public.notifications
    where leave_request_id = r1 and user_id = ana and kind = 'request_approved';
  if n <> 1 then raise exception 'VERIFY_FAILED: the employee (ana) was not told her request was approved'; end if;

  ---------------------------------------------------------------- reject notifies the employee, with the reason
  req := public.submit_leave_request(ana, vac, '2026-12-10', '2026-12-11', 'verify notify reject');
  r2 := req.id;
  req := public.decide_leave_request(maria, r2, 'reject', 'No cover that week');
  select count(*) into n from public.notifications
    where leave_request_id = r2 and user_id = ana and kind = 'request_rejected';
  if n <> 1 then raise exception 'VERIFY_FAILED: the employee (ana) was not told her request was rejected'; end if;
  select count(*) into n from public.notifications where leave_request_id = r2;
  if n <> 2 then raise exception 'VERIFY_FAILED: after reject, request 2 should have 2 notifications, got %', n; end if;
  select decision_reason, decided_by_name into why, who from public.my_notifications(ana)
    where leave_request_id = r2 and kind = 'request_rejected';
  if why is distinct from 'No cover that week' then
    raise exception 'VERIFY_FAILED: the rejection reason did not reach the employee''s notification, got %', why;
  end if;
  if who is distinct from (select name from public.users where id = maria) then
    raise exception 'VERIFY_FAILED: the notification does not name the deciding manager, got %', who;
  end if;

  ---------------------------------------------------------------- refused decisions leave nothing behind
  begin
    perform public.decide_leave_request(maria, r_dan, 'approve', null);
    raise exception 'VERIFY_FAILED: maria decided another team''s request';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm <> 'FORBIDDEN' then raise exception 'VERIFY_FAILED: expected FORBIDDEN, got %', sqlerrm; end if;
  end;
  select count(*) into n from public.notifications where leave_request_id = r_dan;
  if n <> 1 then raise exception 'VERIFY_FAILED: a refused decision changed the notifications (expected 1, got %)', n; end if;

  begin
    perform public.decide_leave_request(maria, r1, 'approve', null);
    raise exception 'VERIFY_FAILED: a request was decided twice';
  exception when others then
    if sqlerrm like 'VERIFY_FAILED%' then raise; end if;
    if sqlerrm <> 'NOT_PENDING' then raise exception 'VERIFY_FAILED: expected NOT_PENDING, got %', sqlerrm; end if;
  end;
  select count(*) into n from public.notifications where leave_request_id = r1;
  if n <> 2 then raise exception 'VERIFY_FAILED: a second decision added a notification (expected 2, got %)', n; end if;

  ---------------------------------------------------------------- each person sees only their own
  select count(*) into n from public.my_notifications(ana) where leave_request_id in (r1, r2);
  if n <> 2 then raise exception 'VERIFY_FAILED: ana should see exactly her 2 decision notifications, got %', n; end if;
  select count(*) into n from public.my_notifications(ana)
    where leave_request_id in (r1, r2) and kind = 'request_submitted';
  if n <> 0 then raise exception 'VERIFY_FAILED: ana can see the manager''s submission notifications'; end if;
  select count(*) into n from public.my_notifications(maria)
    where leave_request_id in (r1, r2) and kind <> 'request_submitted';
  if n <> 0 then raise exception 'VERIFY_FAILED: maria can see ana''s decision notifications'; end if;
  select count(*) into n from public.my_notifications(maria) where leave_request_id in (r1, r2);
  if n <> 2 then raise exception 'VERIFY_FAILED: maria should see her 2 submission notifications, got %', n; end if;
  select count(*) into n from public.my_notifications(paolo) where leave_request_id in (r1, r2);
  if n <> 0 then raise exception 'VERIFY_FAILED: another manager can see maria''s team notifications'; end if;
  select count(*) into n from public.my_notifications(paolo) where leave_request_id = r_dan;
  if n <> 1 then raise exception 'VERIFY_FAILED: paolo should see dan''s submission, got %', n; end if;

  ---------------------------------------------------------------- unread count and mark as read
  a := public.unread_notification_count(ana);
  b := public.unread_notification_count(maria);
  c := public.unread_notification_count(paolo);
  if a < 2 then raise exception 'VERIFY_FAILED: ana''s unread count should be at least 2, got %', a; end if;
  if b < 2 then raise exception 'VERIFY_FAILED: maria''s unread count should be at least 2, got %', b; end if;
  if a = b and a = c then
    raise exception 'VERIFY_FAILED: the unread count looks shared between users (% / % / %)', a, b, c;
  end if;

  n := public.mark_notifications_read(ana);
  if n < a then raise exception 'VERIFY_FAILED: mark read changed % row(s), expected at least %', n, a; end if;
  if public.unread_notification_count(ana) <> 0 then
    raise exception 'VERIFY_FAILED: ana still has unread notifications after marking them read';
  end if;
  if public.unread_notification_count(maria) <> b then
    raise exception 'VERIFY_FAILED: marking ana''s notifications read changed maria''s unread count';
  end if;
  if public.unread_notification_count(paolo) <> c then
    raise exception 'VERIFY_FAILED: marking ana''s notifications read changed paolo''s unread count';
  end if;
  if public.mark_notifications_read(ana) <> 0 then
    raise exception 'VERIFY_FAILED: marking read twice changed rows the second time';
  end if;
  select count(*) into n from public.notifications where user_id = maria and read_at is not null;
  if n <> 0 then raise exception 'VERIFY_FAILED: marking ana''s notifications read touched maria''s rows'; end if;

  ---------------------------------------------------------------- soft-deleted requests drop out
  req := public.submit_leave_request(ana, vac, '2026-12-20', '2026-12-21', 'verify soft delete');
  r3 := req.id;
  d := public.unread_notification_count(maria);
  if d <> b + 1 then raise exception 'VERIFY_FAILED: maria''s unread count should be % after a new request, got %', b + 1, d; end if;
  update public.leave_requests set is_deleted = true where id = r3;
  if public.unread_notification_count(maria) <> b then
    raise exception 'VERIFY_FAILED: a soft-deleted request still counts as unread';
  end if;
  select count(*) into n from public.my_notifications(maria) where leave_request_id = r3;
  if n <> 0 then raise exception 'VERIFY_FAILED: a soft-deleted request is still listed'; end if;

  raise exception 'VERIFY_OK: submit and decide notify only the right person, refusals leave nothing, reads and mark-read are scoped to the caller, soft-deleted requests drop out; rolled back';
end;
$$;
