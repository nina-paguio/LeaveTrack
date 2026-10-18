# Sign-in setup (Supabase Auth email + password)

The app has **no sign-up**. People can sign in only if (1) an admin created their Supabase Auth user and
(2) a row with the same email exists in `public.users`. Passwords are stored by Supabase as a salted hash;
the app never sees them after the check.

## 1. Supabase dashboard (hosted project)
- Authentication → Providers → Email: enabled. **Turn OFF "Allow new users to sign up".**
- Set a minimum password length of at least 12.
- Authentication → Users → Add user → **Create new user**, "Auto Confirm User" on, a **strong, unique
  password** for each person. Test users: `hana@example.com` (HR admin), `maria@example.com` (manager),
  `ana@example.com` (employee).
  - Or run `scripts/create-auth-users.mjs` (see below).
- Passwords are reset by an admin in the dashboard; the app has no "forgot password".

## 2. The `users` table
Each Supabase user needs a matching row (same email, lower-case) with the right `role` and, for an
employee, `manager_id` pointing at their manager. `seed.dev.sql` has the three demo rows and **must never
run against production**.

## 3. Environment variables (`.env.local` and Vercel)
`SESSION_SECRET` (32+ chars, `openssl rand -hex 32`), `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, plus the existing server-only keys. Remove the old
`SESSION_COOKIE_NAME=mock-role` line. Optional: `ALLOWED_EMAIL_DOMAIN`.

## 4. Public deployment
Turn on Vercel Deployment Protection, use strong passwords, and keep real employee data out until the
sign-in is reviewed. Not needed for password sign-in: Site URL and redirect allow-list (magic link / SSO)
and custom SMTP.

## Optional: create the three auth users from the command line
```
SEED_PASSWORD_HR=... SEED_PASSWORD_MANAGER=... SEED_PASSWORD_EMPLOYEE=... \
node --env-file=.env.local scripts/create-auth-users.mjs
```
Emails default to the three demo addresses (`SEED_EMAIL_HR`, `SEED_EMAIL_MANAGER`, `SEED_EMAIL_EMPLOYEE`
override). Passwords must be 12+ characters; they are never printed. Existing users are skipped.
