# Pattern: implement and test

For each Day 1 task, in this order:

1. **Types**: extend `src/types/domain.ts` if the data shape changes.
2. **Data access**: a query function with the scope filter inside the SQL. Pooler connection via `lib/db/pool.ts`.
3. **Test the data function** (scope, soft-delete exclusion, edge cases).
4. **Route or action**: authenticate, authorize, validate with `zod`, call the data function, return `okResponse` / `toErrorResponse`.
5. **Test the route** (401, 403, 400, success; envelope shape).
6. **Wire the UI**: pass real data through the existing props (`onSubmit`, `onDecision`, `requests`). Replace the mock import in the page; do not change component interfaces.
7. **Gate**: `npm run lint && npm run typecheck && npm test && npm run build`.

## Learned in TASK-011

- Put data access behind a small repo interface (`LeaveRepo`) and give services the interface, not the Supabase client. Unit tests then use a fake and the real implementation can be `server-only`.
- `server-only` modules cannot be imported by Vitest. Mock the repo module in route tests (`vi.mock("@/lib/leave/repo", ...)`).
- `supabase db query` runs one statement per call; check a live endpoint by counting rows before and after.
- For a negative test against the real stack (error path), start the server with a bad `SUPABASE_SECRET_KEY` env override: it proves the 500 is generic and writes nothing.
- Never put a required variable in `env.ts` that Day 0 can't boot without: it is imported by `proxy.ts` and 19 other nodes.

## Learned in TASK-012

- Validate a data-backed page three ways against the real stack, not just the happy path: (A) live database as each role (including an empty-data user), (B) a bad `SUPABASE_SECRET_KEY` override to confirm a 500 with no leaked internals, (C) empty `NEXT_PUBLIC_SUPABASE_URL=` / `SUPABASE_SECRET_KEY=` overrides to confirm the mock fallback and its banner.
- Compute derived figures (pending days) in the service from rows the repo returns, so they are unit-testable without a database; filter soft-deleted rows in both the query and the service.
- Do not claim data you do not have: "as of last accrual" was relabelled "Last updated" until accrual records exist.

## Learned in TASK-013

- Security-relevant SQL gets a rolled-back test in a single `DO` block that raises `VERIFY_OK` / `VERIFY_FAILED`. Then **mutation-test the test**: re-run it with a deliberately broken copy of the function (`create or replace` inside the same block) and confirm it reports `VERIFY_FAILED`. A scope test that cannot fail proves nothing.
- Validate the outside-in view, not just the app: call `/rest/v1/rpc/<fn>` and `/rest/v1/<table>` with the **publishable** key and expect `42501 permission denied`.
- A malformed id handed to Postgres is a 500, not a 404. Validate ids with `z.uuid()` in the service, after the authorization check, so a non-manager still gets 403 first.
- Probe schema assumptions that a security rule silently depends on (e.g. "a manager is never their own report") in a rolled-back block, and log what you find.
- A test that fails after a correct behaviour change may just be using an unrealistic fixture (a non-UUID id). Fix the fixture, not the code.

## Learned in TASK-014

- **Put a whole state transition in one SQL function**: lock the row (`FOR UPDATE`), check scope, check "still pending", change status, change balance, write audit, all in one transaction. TypeScript only maps the function's raised messages (`NOT_FOUND`, `FORBIDDEN`, `NOT_PENDING`, ...) to HTTP codes. Then grep for write paths: every `.insert/.update/.delete` in source should be absent, only `rpc()`.
- **NULL makes `<>` checks silently pass**: `owner_manager <> p_manager_id` is NULL (not true) when `p_manager_id` is NULL, so an `IF` skips the refusal. Guard `p_manager_id is null` explicitly, and test with a null caller.
- **Mutation testing finds redundant-looking guards**: the role check was untestable until a case where an *employee* has a direct report existed (the scope check alone blocked every other case). For each guard, ask "which test fails if I delete this line?" and add a case if the answer is none.
- Keep the mutation harness in the repo, not a scratchpad (backlog #34), and re-run it whenever the function changes.
- A live test that must mutate permanent data (delete/truncate are blocked) should be agreed in advance, limited to the smallest write that proves the HTTP path (one reject, no balance change), and recorded in the backlog.

## Learned in TASK-015

- **The NULL pitfall applies to the tests too.** `if rec.decided_by_name <> 'Maria Santos' then raise ...` never raises when the name is NULL (NULL <> 'x' is NULL, and an `IF` treats NULL as false). Compare nullable values with `is distinct from` in every verify script. The mutation harness found this: two audit mutants (decider name never joins, decision time dropped) slipped past a test that looked thorough. A test is only as strong as the mutants it catches.
- Run the mutation harness the moment a new SQL function lands (`node scripts/mutate-sql.mjs <target>`), not only after the tests pass. It lives in `scripts/` and covers the team, decide and audit functions (24 mutants). Add a mutant for each new guard, and for each field the report promises to return.
- A report for compliance must not silently apply an age limit: test with data older than the retention period.
- Privacy by omission: leave sensitive free text out of the SQL function's return type, not just out of the UI, and assert on the JSON keys and the raw response body.
- CLI scripts print by design: scope the `no-console` exception to `scripts/**` and probe that the rule still fires in app code.

## Learned in TASK-016

- **Measure layout, don't infer it.** A headless Chrome script over the DevTools protocol (Node 22 has a built-in `WebSocket`, so no Playwright or Puppeteer) can measure horizontal overflow, tap-target sizes, font sizes and which layout is showing, with real mobile emulation and the page's own viewport tag. Baseline first, fix only what fails, then re-run.
- **Build the measuring tool carefully, then mutation-test it.** Mine had three bugs before it measured anything real: it clicked the header's "Sign out" (first `button[type=submit]` in the DOM) and logged itself out; the cookie check did not verify it had landed on the requested page; and a wrong expected string looked like an app failure. Make the tool verify its own preconditions (`location.pathname`), scope selectors (`main form button`), and prove it still fails when the UI is broken (inject four defects, expect four detections, restore byte-for-byte).
- **Size for the input device, not the width.** iOS zooms on focus for text controls under 16px on any iPhone, including landscape. Use `text-base sm:text-sm pointer-coarse:text-base` (Tailwind v4's `pointer-coarse` variant), and measure a width between `sm` and `md` (700px) to catch the gap.
- A checker needs explicit exemptions that are true to how people use the UI (a radio is tapped through its 44px label; radios have no text to zoom on; the sign-in page has no app shell), documented in the script, not a lowered bar.
- When a change lands in a shared primitive (`controlClass`, 20 dependents), run a regression set over the other pages that use it (`--shared`).

## Learned in TASK-016 (validation)

- **Attack the evidence, not just the product.** The checker passed everything, so I asked what it could not see. Three probes found real defects within an hour: a very long name or a larger system font size pushed "Sign out" off the screen, and the layout broke at 150% and 200% text. Add `--text-scale`, a long-name stress state and an unbroken-token state to any layout check.
- **A check that cannot trigger looks identical to a check that passes.** The "last content hidden under the fixed bottom bar" check passed against code with the padding removed, because the emulated screen (800px) was taller than the page. Use realistic device heights (568, 667, and a 375px landscape phone) and prove every detector with a mutation that must make it fail.
- **When a stress run shows failures, split them by cause and by page** before deciding: fix what is on the task's pages and cheap (header, bottom bar), and log the rest with exact numbers (tables at 768 to 1024px, 200% text on 320px phones) instead of silently lowering the bar.
- **Make text shrink, not push controls away:** `min-w-0 flex-1 truncate` on the variable-length item and `shrink-0` on the controls that must stay reachable; `[overflow-wrap:anywhere]` plus `min-w-0` on nav labels.
