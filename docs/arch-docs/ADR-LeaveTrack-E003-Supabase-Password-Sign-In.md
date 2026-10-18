# ADR-LeaveTrack-E003 — Supabase password sign-in with an app-signed session cookie

**Status:** Accepted (implements the Day 1 step of ADR-LeaveTrack-E001)

## Context
ADR-E001 used a mock cookie on Day 0 and said Day 1 would replace only *how the cookie gets set* with a
real provider. The docs (ARCH, PRD NFR) require an authenticated session, an httpOnly cookie with an 8h
expiry, and scope enforced server-side. They do not name a login method.

## Options considered
1. **Supabase Auth password check, app-signed cookie (chosen).** Supabase verifies the password (stores
   only a salted hash); the app issues its own HMAC-signed 8h cookie. Keeps `proxy.ts`, `getSession()`,
   `homeFor`, the routes, services and SQL unchanged.
2. **Supabase JWT as the session** (`@supabase/ssr`, verify with the JWKS). Standard and revocable, but
   needs token-refresh logic in the proxy and an 8h limit that is a Pro-plan setting on Supabase.
3. **Magic link / company SSO.** Better identity proof; needs SMTP or an IdP. The planned next step.
4. **Email-only lookup (previous demo login).** Does not prove who the visitor is. Replaced.

## Decision
Option 1. `lib/supabase/auth.ts` calls `signInWithPassword` with the publishable key and immediately
revokes the session it creates. `lib/auth/authenticate.ts` decides the result: the password is checked
before the `users` lookup so unknown emails and wrong passwords look identical; the role comes only from
`users` (never from Supabase metadata, which a user can edit). The cookie is signed with `SESSION_SECRET`.

## Consequences
- Positive: passwords are hashed by Supabase and never touched by the app; smallest change; meets the
  8h httpOnly cookie requirement on any Supabase plan; Option 2 or 3 can replace the check later without
  touching the guard.
- Negative: the cookie format is the app's own (not a standard JWT); signing out ends only the app
  cookie; the role is fixed for the 8h session (services still recheck the database role); sign-in
  throttling is best effort per serverless instance.
- **No sign-up.** The app has no sign-up flow. Because the publishable key is public, "Allow new users to
  sign up" must be disabled in Supabase; a new Supabase user still gets no access without a `users` row.
- Fails closed: no `SESSION_SECRET`, Supabase URL or publishable key means no sign-in; no mock fallback.
