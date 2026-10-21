# LeaveTrack

Self-service leave requests, scoped manager approvals and an auditable decision record.

Runs with **no credentials** (mock sign-in, mock data) or against a Supabase project (email + password sign-in, optional Google). See `AGENTS.md` for the rules.

## Requirements

- Node 22+ (`.nvmrc`)

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in at `/login`.

| Role     | Can open                                                      |
| -------- | ------------------------------------------------------------- |
| Employee | `/leave/new`, `/leave/balance` (landing)                      |
| Manager  | the above plus `/team/requests` (landing)                     |
| HR Admin | `/audit` (landing, one employee at a time), `/admin/policies` |

## Login credentials

**Without Supabase configured (fresh clone):** mock sign-in. Pick a role on the sign-in page; any email and password works.

**With Supabase configured (including the Vercel deployment):** the demo accounts below can be used to sign in on Vercel. The role always comes from the `users` table. There is no sign-up and no "forgot password"; an admin creates accounts and resets passwords (`supabase/AUTH-SETUP.md`).

| Role     | Name            | Email               | Password       |
| -------- | --------------- | ------------------- | -------------- |
| HR Admin | Hana Villanueva | `hana@example.com`  | `hradminpass`  |
| Manager  | Maria Santos    | `maria@example.com` | `managerpass`  |
| Manager  | Paolo Reyes     | `paolo@example.com` | `manager2`     |
| Employee | Ana Cruz        | `ana@example.com`   | `employeepass` |

Maria approves Ana, Ben and Carla; Paolo approves Dan, Ella, Faye and Gio. The other six employees are seeded in `users` but have no password listed; create Auth users for them to sign in.

These are **throwaway dev passwords**. Never reuse them, and never create them in production.

## Scripts

| Command             | Purpose          |
| ------------------- | ---------------- |
| `npm run dev`       | Dev server       |
| `npm run build`     | Production build |
| `npm run lint`      | ESLint           |
| `npm run typecheck` | TypeScript       |
| `npm test`          | Vitest           |
| `npm run format`    | Prettier         |

## Environment

Copy `.env.example` to `.env.local`. Every variable is optional on Day 0.

## Database

`supabase/` matches the ARCH data model:

| File                                        | Purpose                                                                                                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migrations/0001_leave_domain.sql`          | 6 tables, delete/truncate blocking triggers, RLS on (deny by default)                                                                                             |
| `migrations/0002_submit_leave_request.sql`  | `submit_leave_request()`: inserts a request and its audit row atomically; service_role only                                                                       |
| `migrations/0003_team_leave_requests.sql`   | `team_leave_requests()`: the manager-scoped queue query; service_role only                                                                                        |
| `migrations/0004_decide_leave_request.sql`  | `decide_leave_request()`: approve/reject atomically (scope, exactly-once, balance, audit); `decision_reason`; no self-management                                  |
| `migrations/0005_employee_audit_report.sql` | `employee_audit_report()`: one employee's decision history for HR; read-only; excludes soft-deleted; service_role only                                            |
| `migrations/0006_monthly_accrual.sql`       | `run_monthly_accrual()`, the `last_accrued_month` marker and the `accrual_runs` log                                                                               |
| `migrations/0007_notifications.sql`         | `notifications` table (RLS on); submit/decide now write the in-app notification; `my_notifications()`, `unread_notification_count()`, `mark_notifications_read()` |
| `migrations/0008_retention.sql`             | `soft_delete_expired_requests()`: soft-deletes requests decided more than 3 years ago (rows stay; the app stops showing them); service_role only                  |
| `seed.sql`                                  | Reference data only (3 leave types). Safe in every environment.                                                                                                   |     |
| `verify-accrual.sql`                        | Rolled-back test of the accrual: exact amounts, same-month no-op, per-row marker, bad months, run log                                                             |
| `verify-audit.sql`                          | Rolled-back test of the audit report: exactness, soft-delete exclusion, 3+ year retention, privacy, date range                                                    |
| `verify-decide.sql`                         | Rolled-back test of approve, reject, scope, exactly-once, roles, Unpaid, day rule and self-approval                                                               |
| `verify-team.sql`                           | Rolled-back scope test: exactly 5 reports, no leaks, request follows an employee who changes manager                                                              |
| `verify.sql`                                | Read-only checks for TASK-010 acceptance criteria                                                                                                                 |

Apply with the Supabase CLI against a **dev** project, using the session-mode pooler (port 5432 on the
same pooler host). Transaction mode (6543) is for app traffic and can fail on migrations:

```bash
supabase db push --dry-run --db-url "$MIGRATION_DB_URL"   # review first
supabase db push --db-url "$MIGRATION_DB_URL"
```

`MIGRATION_DB_URL` is `DATABASE_URL` with the port changed to 5432. Keep both in `.env.local`, never in the repo.

`supabase db query` runs **one statement per call**, so it cannot execute `seed.dev.sql` or `verify.sql` as whole files (`seed.sql` is a single statement and works with `-f`). For those two, paste the file into the Supabase dashboard SQL editor, or run it statement by statement. `verify.sql` ends with a `DO` block that is expected to _fail_ with `VERIFY_OK: delete and truncate are blocked`; that error means it passed, and nothing is persisted.

## Not in Day 0

Real authentication, notifications (a structured log line stands in for the manager notification), the accrual job, and every API route except `/api/health` and `POST /api/leave-requests` and `GET /api/leave-requests?scope=mine` `?scope=team` `POST /api/leave-requests/:id/decision` and `GET /api/audit/:userId`.

## Docs

`docs/brd`, `docs/prd`, `docs/arch-docs`, `docs/dev-task`, and `knowledge/` (project rules, prompts and patterns).

## Mutation-testing the SQL

`node scripts/mutate-sql.mjs decide|audit|team|all` runs each rolled-back `verify-*.sql` against deliberately broken copies of its function and requires every one to be caught. Nothing is committed. Needs the Supabase CLI and `DATABASE_URL` in `.env.local`. **Dev databases only:** the script runs `drop`/`create or replace` on live functions inside rolled-back transactions, which would briefly lock them under production traffic. It refuses to run when `APP_ENV=prod`.

## Checking the mobile layout

`npm run check:viewport` drives headless Google Chrome with mobile emulation and measures the submit-request form and the balance page (employee and manager) at 320, 375, 700, 768, 1024 and 1440px: horizontal overflow, tap-target sizes, control font sizes, and desktop-only pieces showing on a phone. It also opens the form in its error and over-balance states, stresses the header with a very long name, checks that the last piece of content is not hidden under the fixed bottom bar on short phones (568px and 667px tall), and can simulate a larger system font with `--text-scale=1.5`. It never submits a form and writes nothing to a database. Screenshots go to `tmp/viewport/` (git-ignored).

```bash
npm run build && npm start          # in one terminal (or npm run dev)
BASE_URL=http://localhost:3000 npm run check:viewport
npm run check:viewport -- --shared  # also login, team queue, audit and policies (regression)
npm run check:viewport -- --text-scale=1.5   # simulate a 150% system font size
```

It only targets `localhost`, and needs Chrome (set `CHROME_PATH` if it is not at the macOS default) and Node 22. This is Chrome's emulation, not an iPhone: it cannot show the real iOS focus-zoom or the native date-picker UI.

## Git and CI

- **Branch:** `main`. CI (`.github/workflows/ci.yml`) runs on every pull request and every push to `main`: `npm ci`, `npm audit --omit=dev --audit-level=high`, lint, typecheck, tests and the production build. It needs no secrets and no environment variables.
- **Commits:** Conventional Commits, enforced locally by commitlint (`feat: …`, `fix: …`, `docs: …`, `chore: …`). The pre-commit hook runs ESLint and Prettier on staged files, so a commit can take a few seconds. Don't bypass hooks with `--no-verify`.
- **Never commit secrets.** `.env*` is git-ignored except `.env.example`. Real values live in `.env.local` (local) and the host's environment variables (Vercel). Use a **private** repository.
- **Not tracked on purpose:** `graphify-out/` (a generated code graph), `supabase/.temp/` (CLI scratch), `tmp/` (viewport screenshots) and `.claude/settings.local.json`.
- **A fresh clone runs with no credentials:** `npm install && npm run dev`. Pages that read the database fall back to mock data and show a banner.

## Monthly accrual (cron)

Leave balances accrue once a month through `/api/jobs/accrual` (BR-06). The month is the current **Asia/Manila** month, and a repeat in the same month changes nothing. Design: `docs/arch-docs/ADR-LeaveTrack-E002-Accrual-Idempotency.md`.

- **Schedule:** `vercel.json` runs it at 02:00 UTC on the 1st (10:00 in Manila). Vercel Cron only runs on a **production** deployment, and sends a `GET` with `Authorization: Bearer <CRON_SECRET>`.
- **Secret:** set `CRON_SECRET` in `.env.local` (generate with `openssl rand -hex 32`) and, when you deploy, in the Vercel project's environment variables. Without it the route refuses to run (503).
- **Run by hand** (this really changes balances in whatever database `.env.local` points at):

```bash
curl -X POST http://localhost:3000/api/jobs/accrual \
  -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2)"
# first run in a month:  {"success":true,"data":{"month":"2026-10-01","accrued":14,"skipped":0,"alreadyRun":false}}
# same month again:      {"success":true,"data":{"month":"2026-10-01","accrued":0,"skipped":14,"alreadyRun":true}}
```

- **Not caught up:** if a month is skipped, nobody back-fills it. New joiners get a full month. Both are business decisions recorded in the ADR.
