# ADR-LeaveTrack-E002: Monthly accrual and idempotency

**Status:** Accepted

Referenced by `ARCH-LeaveTrack-v1.0.md` (API table, `POST /api/jobs/accrual`). Implements BR-06 and US-07.

## Context

Leave balances must accrue automatically every month, from each person's policy, with no manual HR step
(BR-06). The job runs on a schedule, and schedulers deliver at least once: Vercel Cron can call the route
twice, an operator can call it by hand, and a retry can follow a timeout. Running it twice in a month must
never add twice (US-07 AC2), and an error must never leave some balances accrued and others not.

Constraints from the project:

- Company calendar: **Asia/Manila** (UTC+8, no daylight saving).
- Vercel cron expressions are UTC. `0 2 1 * *` is 02:00 UTC, which is 10:00 in Manila on the 1st.
- Vercel Cron sends **GET** with `Authorization: Bearer <CRON_SECRET>`. The ARCH doc and task say POST.
- Rules that guard money-like data live in SQL, not application code (see ADR practice in `AGENTS.md`).
- Unpaid has no balance and no policy (BR-07).

## Options considered

1. **A global "already ran for month M" flag** (a row per month, checked before running).
   - Pros: trivial to read.
   - Cons: a user who gets a policy mid-month, or a run that failed halfway, is never accrued; "run" and
     "balances changed" can disagree.
2. **A marker on each balance row (`last_accrued_month`)**, updated in the same statement that adds the amount.
   - Pros: idempotency is a property of each row, so a repeat changes nothing, a partial run can be
     re-run safely, and a new policy is picked up the next time; the marker is also the real answer to
     "accrued through when?" for the balance page.
   - Cons: one more column.
3. **An append-only ledger of accrual entries** (balance = sum of entries).
   - Pros: full history of every credit.
   - Cons: a bigger redesign of how balances are stored and read, beyond this task.

## Decision

Option 2, plus a small run log:

- `leave_balances.last_accrued_month date` is the idempotency marker.
- `run_monthly_accrual(p_month date)` (migration `0006`) does everything in one transaction:
  one upsert over every policy whose leave type tracks a balance; an existing row is updated only where its
  marker is null or **earlier** than the month; a missing row is created. It returns how many rows
  accrued and skipped.
- A repeat in the same month changes nothing; an earlier month cannot run after a later one.
- An advisory lock makes two overlapping runs take turns.
- `accrual_runs` records every invocation (including no-op repeats) with the month and the counts.
- The app passes **the first day of the current Asia/Manila month**. There is no parameter to choose a
  month, so there is no accidental future or back-dated accrual. Missed months are **not** caught up.
- A person who joins mid-month gets a **full** month's accrual (no pro-rating rule exists in the BRD/PRD).
- The route `/api/jobs/accrual` accepts **GET and POST** and behaves identically. GET is what Vercel
  Cron sends; POST is what the ARCH doc specifies and what an operator uses by hand.
- Authentication is `Authorization: Bearer <CRON_SECRET>`, compared in constant time. If `CRON_SECRET`
  is not configured the route refuses (503): it fails closed. The login proxy exempts exactly this path
  because the caller has no session; no other path under `/api/jobs/` is exempt.

## Consequences

- Positive: duplicate deliveries are harmless; a crash mid-run rolls back; the balance page can show
  "Accrued through October 2026" from real data; the rule is tested in SQL with mutation tests.
- Negative: a skipped month stays skipped until someone decides how to back-fill it. The monthly
  schedule cannot be exercised until a production deployment exists (Vercel runs cron only on production).
- Negative: GET with a side effect is unusual HTTP. It is acceptable here because the operation is
  idempotent per month and is gated by a secret, and because the platform dictates GET.
- Follow-ups: pro-rating for mid-month joiners, back-fill of missed months, and mid-year policy changes
  (ARCH open question) are business decisions that would change this function.
