# AGENTS.md: LeaveTrack

Rules for every AI coding tool and developer working in this repo.

## Project

LeaveTrack replaces an email-and-spreadsheet leave process: employees submit requests and see balances, managers approve for their own direct reports only, HR gets an auditable record (3-year retention).

- **Stack:** Next.js 16 (App Router) + TypeScript, Tailwind v4, Tabler icons, Postgres on Supabase, deployed on Vercel.
- **Sources of truth:** `docs/brd`, `docs/prd`, `docs/arch-docs` (ARCH + ADRs), `docs/dev-task/*.csv`.
- **Roles:** `employee`, `manager`, `hr_admin`.

## Day 0 state (read this first)

- **Sign-in is Supabase Auth email + password (ADR-LeaveTrack-E003).** `/login` takes an email and a password. `lib/supabase/auth.ts` checks them with Supabase (the publishable key; Supabase stores only a salted hash and the app never stores, logs or returns a password), then revokes the Supabase session. The role comes from the `users` table, never from the form or from Supabase metadata. The app sets its OWN httpOnly cookie **signed** with `SESSION_SECRET` (8h; `lib/auth/session-token.ts`); `proxy.ts` and `getSession()` verify it. Fails closed without `SESSION_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **There is no sign-up**: accounts are created by an admin (`supabase/AUTH-SETUP.md`), and "Allow new users to sign up" must be off in the Supabase dashboard. Every refusal shows the same generic message. Decision logic lives in `lib/auth/authenticate.ts` (tested without a network).
- **Real data for the employee flow, mock for the rest.** `/leave/new` and `/leave/balance` (the employee's balance and requests on one page; `/leave/requests` redirects there) read the database (via `lib/leave/mine-data.ts`) and fall back to `src/mocks/data.ts` when Supabase is not configured. The manager Approvals page (the manager's landing page, 10 rows per page via `?page=`) and detail page also read the database (TASK-013). There is no dashboard: the docs define none, so each role lands on its main task (`homeFor` in `lib/roles.ts`: employee `/leave/balance`, manager `/team/requests`, HR `/audit`). The HR audit report reads the database too (TASK-015, one employee at a time). The policies page is still mock until the policy task.
- **Almost no business logic.** `/api/health` and `/api/leave-requests` (`POST` TASK-011, `GET ?scope=mine` TASK-012, `GET ?scope=team` TASK-013, plus `POST /api/leave-requests/:id/decision` TASK-014) `GET /api/audit/:userId` (TASK-015, HR only) and `/api/jobs/accrual` (TASK-017, cron only) are the only routes. Everything else in the ARCH API table is still Day 1.
- Design tokens in `src/app/globals.css` are provisional (no design export was provided).

## Backend standards

- Every non-2xx API response uses `{ success: false, error: { code, message } }` via `lib/errors.ts`. Never leak internal error text.
- Manager scope is enforced **in the SQL query** (`WHERE manager_id = :current_user_id`), never only in application code. Acting on a non-direct-report returns 403.
- **No hard deletes** of `leave_requests` or `audit_log`; soft delete via `is_deleted` only (BR-04). The migration blocks DELETE with a trigger.
- Approve/reject writes an `audit_log` row; balance changes touch only the request's own `leave_type_id`. Unpaid has no balance check.
- Accrual (`/api/jobs/accrual`, GET and POST) is one idempotent SQL function (see below, ADR-LeaveTrack-E002). Note: Vercel Cron issues GET requests, so Day 1 must reconcile this with the documented POST (ADR-LeaveTrack-E002 is referenced by the ARCH doc but missing).
- Use the Supabase **pooler** URL, never the direct connection. App traffic uses transaction mode (6543); migrations use session mode (5432, same pooler host).
- **RLS is on for every table** (deny by default). Tables in `public` are exposed through the Supabase Data API, so every new table must `enable row level security` in the same migration. The secret key bypasses RLS: server-only, never `NEXT_PUBLIC_`.
- `TRUNCATE` is a hard-delete path: `leave_requests` and `audit_log` are protected by triggers. Tests clean up by rolling back transactions, not by deleting.
- `seed.dev.sql` (mock users) is dev only and must never run against production.
- Log with `lib/logger.ts`; `console.*` is an ESLint error.
- Quality gate for Day 1: p95 < 500ms on balance and request-list endpoints.
- Route guard file is `src/proxy.ts` (exports `proxy`), not `middleware.ts`.

## Frontend standards

- Server components by default; add `"use client"` only for state/effects/handlers.
- Components take data through typed props. No fetching, no business logic inside components.
- Colors come from `@theme` tokens only: no raw hex/rgb/hsl in components. Any hand-written base selector in `globals.css` must sit inside `@layer base`.
- Mobile-first; must work at 320, 375, 768, 1024, 1440px with no horizontal scroll (BR-05). Tap targets at least 44px.
- Accessible by default: semantic HTML, labelled controls, `aria-describedby` for errors, status never conveyed by color alone, visible focus.
- Icons: `@tabler/icons-react` at 16/20/24px, `aria-hidden` when decorative.

## Security

- No secrets in the repo; `.env*` is git-ignored except `.env.example`.
- Session cookie: httpOnly, SameSite=Lax, Secure in production, 8h expiry.
- Security headers live in `next.config.ts`. CSP currently allows `'unsafe-inline'` scripts (Next bootstrap); move to nonces in Day 1.

## Git conventions

- Conventional Commits (enforced by commitlint). Pre-commit runs lint-staged (ESLint + Prettier).
- CI sets `HUSKY=0`. Don't bypass hooks with `--no-verify`.

## Quality gates (must pass before merge)

`npm run lint` · `npm run typecheck` · `npm test` · `npm run build`

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Data access (TASK-011 pattern)

- Routes: authenticate (401) → authorize role (403) → validate with zod (400) → service → `okResponse` / `toErrorResponse`.
- Services take a repo interface (`LeaveRepo`), never the Supabase client, so tests use a fake and write nothing.
- The Supabase implementation (`lib/leave/repo.ts`, `lib/supabase/server.ts`) imports `server-only` and uses the secret key. Never import it from a client component.
- Multi-statement writes go in a Postgres function called through `rpc` (supabase-js has no transactions). Revoke execute from `public`, `anon`, `authenticated`; grant to `service_role`.
- Mock identity maps to a seeded user by email, because mock ids are not database UUIDs.
- Tests never insert into a real database: delete/truncate are blocked by triggers, so test rows would be permanent.
- Read services (`lib/leave/mine.ts`) take a read-repo interface scoped to one user id taken from the session. A query parameter must never choose whose data is read.
- Server pages call the service through `lib/leave/mine-data.ts` (real data, or mocks when unconfigured); they do not fetch their own API.
- **Manager scope lives in SQL.** `team_leave_requests(p_manager_id)` (migration 0003) holds the `WHERE manager_id` join. The TypeScript layer passes the session user's id and never filters by team. Services check the **database** role (`RepoUser.role`), not the session cookie. Any new manager-scoped read must be a SQL function with its own rolled-back test (see `supabase/verify-team.sql`).
- Security-relevant SQL is tested in a single `DO` block that always raises `VERIFY_OK`/`VERIFY_FAILED`, so nothing it creates is committed (delete/truncate are blocked, so test rows would be permanent).
- **Decisions are one SQL function.** `decide_leave_request()` (migration 0004) does the scope check, the exactly-once (`NOT_PENDING`) check, the status change, the balance change and the audit row in one transaction. TypeScript passes only the session user's id and maps the function's refusals (`NOT_FOUND`, `FORBIDDEN`, `NOT_PENDING`, `REASON_REQUIRED`, `INVALID_DECISION`) to 404, 403, 409, 400. Never reimplement any of those checks in application code, and never write status/balance/audit rows from TypeScript.
- Approving can take a balance below zero (submit allows over-balance "for HR override"). Days are inclusive calendar days in both SQL and `lib/leave/days.ts`; a test pins them together.
- `users.manager_id` may never equal the user's own id (constraint `users_not_own_manager`), and a manager can never decide their own request.
- **The HR audit report** is `employee_audit_report(user, from, to)` (migration 0005): read-only, excludes soft-deleted rows in SQL, has no age limit (3+ year retention, nothing purges), and never returns the employee's own free-text reason. The route checks the **database** role is `hr_admin`; the proxy also gates `/api/audit`. Reports are per employee, never an all-staff dump, and each view is logged (`audit_report_viewed`).
- **Notifications are written by the database, not by TypeScript (migration 0007, ADR-LeaveTrack-E004).** `submit_leave_request()` notifies the employee's manager and `decide_leave_request()` notifies the request's owner, inside the same transaction, so a notification is never missing or left behind by a refused decision. Never insert into `notifications` from application code. Reads and marking read go through `my_notifications` / `unread_notification_count` / `mark_notifications_read`, which filter on the recipient in SQL; the service passes only the session user's id. HR receives none. The employee's free-text reason must never be copied into a notification. Any change to those functions needs `supabase/verify-notifications.sql` and `node scripts/mutate-sql.mjs notify-submit|notify-decide|notify-list|notify-count|notify-read` (and `decide`) to pass.
- **Mutation-test every security SQL function**: `node scripts/mutate-sql.mjs decide|audit|team|all` swaps broken copies into the rolled-back verify scripts and must report every mutant caught. Re-run it whenever a function changes, and add a mutant for any new guard.
- **Mobile layout is measured, not assumed.** Run `npm run check:viewport` (needs a running server and Google Chrome) after touching shared UI (`controls.tsx`, `form-field.tsx`, the app shell, nav, cards, tables). Add `-- --shared` to also check the login, team queue, audit and policies pages. It must report 0 failing at normal text size on every page (also try `-- --text-scale=1.5`, which simulates a 150% system font; the two task pages must pass it): no horizontal scroll at 320/375/700/768/1024/1440px, tap targets of at least 44px and text controls of at least 16px on touch devices (iOS zooms the page on focus below 16px), no desktop sidebar or table on a phone, and the bottom bar present. Text controls use `text-base sm:text-sm pointer-coarse:text-base`: 16px on phones and on any touch screen, 14px for mouse users from the `sm` breakpoint up.
- **Monthly accrual** is `run_monthly_accrual(month)` (migration 0006). Idempotency is a per-row marker (`leave_balances.last_accrued_month`): a row is only raised if its marker is null or earlier than the month, so repeats and duplicate cron deliveries change nothing. The app passes only **the first day of the current Asia/Manila month** (`currentAccrualMonth`); there is no way to choose a month. Do not accrue anywhere else, and do not write `balance` from TypeScript.
- **`/api/jobs/accrual` has no session**, so `proxy.ts` exempts that exact path and the route authenticates with `Authorization: Bearer <CRON_SECRET>` (constant-time compare). It **fails closed**: no `CRON_SECRET` means 503 and nothing runs. Never widen the exemption to a prefix, never log the secret, and keep `proxy.test.ts` green.
- Vercel Cron sends GET (not POST), so the route accepts both and they behave identically. Cron runs only on a **production** deployment, and Vercel sends the project's `CRON_SECRET` automatically.
