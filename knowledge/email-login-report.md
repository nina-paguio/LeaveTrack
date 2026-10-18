> **Superseded (2026-10-19)** by ADR-LeaveTrack-E003: sign-in is now Supabase Auth email + password. The email-only login described below is no longer in the code.

# Email-only login: what we decided and changed

Date: 2026-10-19 · Branch: `sdlc/first` · Status: built, not committed, not yet tried in a browser

## Goal

Replace the mock login (any input accepted, role chosen on the form) with a login that takes a **company email only**, so the presentation can show all three RBAC roles (employee, manager, HR admin). The app will be deployed to Vercel on the public internet.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Verify mailbox ownership (magic link)? | **No, not for now.** Email lookup only. | The login is for a presentation. Magic link was the recommended option and stays the plan for real use. |
| What does RBAC use? | The existing `users` table (`employee`, `manager`, `hr_admin`, `manager_id`). | Supabase Auth proves identity only; it has no ready-made roles. Roles stay in the database and SQL, as in AGENTS.md. |
| Where does the role come from? | The database (or mock users when no database is configured), **never the form**. | The old form let anyone pick any role. |
| Allowed emails | Exact domain in `ALLOWED_EMAIL_DOMAIN` (no subdomains or lookalikes) **and** a matching row in `users`. | Limits who can sign in. Same generic error for every refusal, so the form does not reveal which emails exist. |
| Supabase Auth cost / testing (discussed) | Free plan covers Auth (about 50,000 monthly active users). Built-in mailer is test-only; production needs custom SMTP. Local Supabase (Docker) has a fake inbox for testing. | Only relevant when we move to magic link. |

## Known limitation (important)

This login proves the email's **domain** and that the person **exists in `users`**. It does **not** prove the visitor owns the mailbox. Anyone who knows or guesses a valid address, including an HR admin's, can sign in as that person. It is acceptable for a controlled demo only. **Do not use it with real staff data.** Replace it with magic link (Supabase Auth) or Google/Microsoft SSO before real use.

## Safeguards added

- **Signed session cookie** (HMAC-SHA256, 8h expiry). The old cookie held a plain role, so anyone could forge it. Edited or expired cookies are treated as signed out, in both `proxy.ts` and `getSession()`.
- **Fails closed**: sign-in is refused unless `SESSION_SECRET` (32+ characters) and `ALLOWED_EMAIL_DOMAIN` are set.
- **Optional `DEMO_ACCESS_CODE`**: when set, the form also asks for it. Recommended for the public deployment.
- **Rate limit** on sign-in attempts per IP. Best effort only: on Vercel each serverless instance has its own memory, so it slows guessing but is not a hard limit.
- Constant-time comparisons for the signature and the access code.

## What changed

New:
- `src/lib/auth/session-token.ts` (sign and verify), `email.ts` (normalise, domain check), `rate-limit.ts`, `resolve-user.ts` (role lookup), `auth.test.ts`
- `src/components/auth/login-form.tsx` (client form with an accessible error message)

Changed:
- `src/app/(auth)/actions.ts`: new `loginAction` (domain, access code, rate limit, role lookup, signed cookie)
- `src/app/(auth)/login/page.tsx`: email-only form, password field and role picker removed
- `src/lib/session.ts`, `src/proxy.ts`: verify the signed cookie
- `src/lib/env.ts`: added `SESSION_SECRET`, `ALLOWED_EMAIL_DOMAIN`, `DEMO_ACCESS_CODE`; cookie name default is now `leavetrack-session`
- `.env.example`, `AGENTS.md`, `vitest.config.ts`, `src/proxy.test.ts` (signed cookies, forged-cookie tests), `scripts/viewport-check.mjs` (signs its own cookie)

Removed: `src/components/layout/role-switcher.tsx`.

## Verification

`npm run lint`, `npm run typecheck`, `npm test` (163 tests) and `npm run build` pass. **Not done:** trying the login in a browser, and `npm run check:viewport` after the form change.

## To run it

Locally, create `.env.local` with `SESSION_SECRET` (`openssl rand -hex 32`) and `ALLOWED_EMAIL_DOMAIN=example.com`, run `npm run dev`, and sign in at `/login` with a seeded email: `hana@example.com` (HR), `maria@example.com` (manager), `ana@example.com` (employee).

On Vercel, set the same variables plus `DEMO_ACCESS_CODE`. Use `stratpoint.com` only after the real `@stratpoint.com` users exist in `users` with the correct roles and managers.

## Before real use

1. Replace the email-only sign-in with magic link (custom SMTP, Site URL and redirect allow-list in Supabase) or company SSO.
2. Load real employees into `users`; `seed.dev.sql` must never run against production.
3. Consider Vercel Deployment Protection or a WAF as a perimeter for the public demo.
