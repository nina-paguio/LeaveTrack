# Design restyle, role landing pages, pagination (2026-10-19)

Source: Figma Make export (`design/make-export`), PRD US-01..US-08, BRD BR-01/02/04. Docs define no
dashboard, so each role lands on its main task (`homeFor` in `lib/roles.ts`).

## Backlog (deferred)
- **Approvals pagination is a TypeScript slice** of the list `team_leave_requests` already scoped. If a
  manager can have hundreds of requests, move `limit/offset` into the SQL function (new migration, update
  `verify-team.sql` and the `team` mutants).
- **Team table at 1024px with `--text-scale=1.5` overflows by ~54px.** Not a required task page, but fix
  (fewer columns or a narrower decision cell).
- **Pagination was not measured with more than one page**: mock data has 2 team rows. Add mock rows or a
  viewport state with > 10 rows.
- **Request detail (`/team/requests/[id]`) has no approve/reject and no over-balance ("HR override") notice.**
  Needs balance data in the detail service; outside the restyle scope.
- **Role gate for submit and own balance lives in proxy + route only.** The submit/mine services do not
  check the database role (managers/HR are blocked at the route). Add a DB-role check if wanted.
- **Docs gaps to raise with the BA**: who approves a manager's own leave; whether HR requests leave; policy
  editing story (US-07 only covers accrual); mid-year policy changes (ARCH open question).
- **CSV task statuses are all "Open"** although TASK-010..018 are implemented; update them. Confirm
  migration 0003 is applied and run `verify-team.sql` + `node scripts/mutate-sql.mjs team` on the real DB.

## Patterns worth keeping
- Deleting a route leaves stale generated types in `.next` (`.next/types`, `.next/dev/types`) that fail
  `tsc` and `next build`; remove `.next` and rebuild.
- Stash-based baselines break when config (tsconfig exclude) is stashed too; compare in a worktree.
- After rebuilding, kill every process on the port before `check:viewport`; a stale server serves old
  assets and shows false mass failures.

## Added by the UI polish pass (validate)
- **Viewport check could not be re-run after the signed-session login landed in the same working tree**
  (`src/lib/auth/*`, `actions.ts`, `session.ts`, `proxy.ts` were changed outside this pass). The script now
  needs `SESSION_SECRET`; with a throwaway secret on both build and server the app still redirected to
  /login. Last green run (48/48, normal and 150% text) was before that change. Re-run
  `check:viewport --shared` (+ `--text-scale=1.5`) once the auth work is settled.
- **Pager with more than one page was only seen on the mock Policies list** (2 pages) before the pager
  was moved bottom-right with "Page 1/1"; re-check visually with real >10-row data.
- **Pager arrows are 32px for a mouse and 44px on touch** (AGENTS.md tap-target rule).
- **Dialog for over-balance submit was verified through the viewport state only**, not end to end
  against the database.

## Supabase password sign-in (ADR-LeaveTrack-E003) — validate
- **Successful sign-in not exercised**: it needs the three auth users created (supabase/AUTH-SETUP.md or
  scripts/create-auth-users.mjs) plus matching `users` rows. Verified so far: Supabase answers a wrong
  login `400 invalid_credentials` (mapped to "refused"), and the real form shows one generic message and
  sets no cookie for a wrong password, a malformed email and an empty password.
- **Possible email-enumeration timing signal**: an unknown email may fail faster than a known email with a
  wrong password (bcrypt compare inside Supabase). Generic messages hide the text, not the timing.
- **Throttle is per serverless instance and in memory**; Supabase's own limits are the stronger layer.
  A successful sign-in now clears its keys, so rehearsing role switches cannot lock the demo out.
- **Cookie role is fixed for 8h**: removing a user or changing their role does not end an existing
  session; services recheck the database role on every request.
- **Switch to the Supabase JWT session (ADR option 2) or magic link/SSO** when central revocation or an
  identity proof beyond a password is needed.
- **Pattern**: for a Next server-action form, replay `$ACTION_REF_*`/`$ACTION_*:*` hidden fields with a
  multipart POST to test the real action without a browser.

## In-app notifications (ADR-LeaveTrack-E004)
- **Migration 0007 is not applied until the user approves it**, and verify-notifications.sql plus the
  `notify-*` and `decide` mutation runs only mean something against a database that has it.
- **Not live**: badge and list refresh on page load. Supabase Realtime or polling is the upgrade path.
- **HR gets no notification** (docs name none). **No backfill** and **no cleanup/retention** yet.
- **List capped at 200 per user** in SQL; the page pages through those 10 at a time.
- **Email later**: the notifications table can serve as the outbox; failures must not undo the request.
- **ARCH data model needs a `notifications` table entry.**
- **Pattern**: a mutation target for a function that is replaced by a later migration must point at the
  migration that currently defines it (decide moved from 0004 to 0007); the harness now accepts
  `create or replace function`.
