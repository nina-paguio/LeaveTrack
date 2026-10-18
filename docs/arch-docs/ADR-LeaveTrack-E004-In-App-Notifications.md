# ADR-LeaveTrack-E004 — In-app notifications

**Status:** Accepted

## Context
PRD US-01 AC1 says the manager is notified when a request is submitted, and US-03 says the employee is
notified when it is decided. The docs name no channel. Until now a structured log line stood in for it
(backlog #12), so nobody was actually told anything.

## Options considered
1. **Email through a provider** (Resend etc.): needs an API key and a verified sending domain; an outage
   or failure must not undo the request.
2. **In-app notifications (chosen):** no outside service; the same database transaction that records the
   request or decision records the notification.
3. **Both:** email as an alert, in-app as the record. The notifications table can later act as the
   outbox for email.

## Decision
Option 2. Migration `0007_notifications.sql` adds a `notifications` table (recipient, request, kind,
`read_at`) with RLS on. `submit_leave_request` notifies the employee's manager; `decide_leave_request`
notifies the request's owner. Both inserts are inside the existing transaction, so a notification can
never be missing, or left behind by a refused decision. Reads and writes go only through three
service_role functions whose recipient filter is in the SQL: `my_notifications` (200 newest),
`unread_notification_count`, `mark_notifications_read`. Only a kind and a request id are stored; the
wording is built in `lib/leave/notifications.ts` from names, leave type and dates. The employee's
free-text reason is never in a notification; a rejection shows the manager's decision reason.

## Consequences
- Positive: US-01 AC1 / US-03 are met with no new dependency; atomic with the request; tested by
  `supabase/verify-notifications.sql` and mutation-tested (`notify-*` targets).
- Negative / limits: not live (the badge and list refresh when a page loads); HR receives none (the docs
  name none); an employee with no manager creates a request nobody is notified about (existing gap); no
  backfill of requests made before the migration and no cleanup of old notifications.
- The ARCH data model does not list a `notifications` table; ARCH needs a note.
