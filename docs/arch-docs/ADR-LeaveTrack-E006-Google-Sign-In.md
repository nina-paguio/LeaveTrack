# ADR-LeaveTrack-E006 — Google sign-in through Supabase, same app-signed session cookie

**Status:** Accepted (extends ADR-LeaveTrack-E003; password sign-in stays)

## Context
ADR-E003 named company SSO as the planned next step. Google gives a stronger proof of identity than a
password the admin hands out, and many staff already have a company Google account.

## Decision
"Sign in with Google" sits beside the password form, behind `GOOGLE_SIGN_IN_ENABLED=true`.

- **Flow.** `GET /api/auth/google` asks Supabase for the Google address with PKCE (`lib/supabase/oauth.ts`,
  publishable key) and keeps the PKCE verifier in a 10-minute httpOnly cookie scoped to `/api/auth/google`.
  Google returns to `GET /api/auth/google/callback`, which trades the one-time code plus that cookie for the
  Google identity, revokes the Supabase session at once, and sets the app's own signed cookie through
  `lib/auth/session-cookie.ts` (the same code password sign-in uses: httpOnly, SameSite=Lax, Secure in
  production, 8h).
- **Decision logic** is `authenticateGoogle` in `lib/auth/authenticate.ts` (no I/O, tested without a
  network): no code or no verifier, an email Google has not verified, a code Supabase rejects, a wrong
  company domain (`ALLOWED_EMAIL_DOMAIN`) and a person missing from `users` are all "refused" with the same
  generic message. The role comes ONLY from `users`, and the email from the Google identity record (which a
  user cannot edit), never from user metadata.
- **No sign-up.** "Allow new users to sign up" stays OFF in Supabase. Supabase therefore refuses a Google
  user who has no Supabase Auth user: the admin creates the auth user as before, and Supabase links the
  Google identity to it by email. A Google account alone never grants access.
- **No redirect parameter.** After sign-in the person lands on `homeFor(role)`; nothing in the URL can
  choose the destination, so there is no open redirect.
- **Proxy.** `/api/auth/google` and `/api/auth/google/callback` are public by EXACT path (never a prefix);
  `proxy.test.ts` pins that nothing nearby is opened.
- **Fails closed:** no `SESSION_SECRET`, Supabase URL/key, or `GOOGLE_SIGN_IN_ENABLED` means the routes
  send the person back to `/login?error=unavailable`.
- **Throttling:** the callback shares the per-IP limiter with password sign-in (best effort per instance).

## Consequences
- The Google client id and secret live only in the Supabase dashboard; nothing secret enters the repo.
- The verifier cookie binds the callback to the browser that started it (a callback with no matching
  cookie is refused), which is what stops a forged login link from signing a victim into someone else's
  account.
- Admins still create the Supabase Auth user and the `users` row for each person.
- Needs per-environment setup (Google Cloud OAuth client; Supabase Site URL and redirect allow-list): see
  `supabase/AUTH-SETUP.md`. A wrong redirect URL fails sign-in only in that environment.
- **supabase-js detail.** The installed `@supabase/auth-js` keeps each PKCE verifier in a per-flow slot
  (`...-flow-<id>-code-verifier`). The callback replays that slot into a fresh client and names the flow
  (`exchangeCodeForSession(code, { flowId })`). `src/lib/supabase/oauth.test.ts` runs the real client against
  a fake Supabase server so an upgrade that changes this fails a test instead of breaking sign-in.
