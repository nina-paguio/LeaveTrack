#!/usr/bin/env node
// Creates the three demo Supabase Auth users (HR admin, manager, employee) with Auto Confirm, using the
// SECRET key. Run it yourself against the project you mean to change; nothing runs it automatically.
// Passwords come from the environment, are never printed, and Supabase stores only a salted hash.
// It creates auth users only: the matching rows in public.users must exist too (see supabase/AUTH-SETUP.md).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const accounts = [
  ["HR", process.env.SEED_EMAIL_HR ?? "hana@example.com", process.env.SEED_PASSWORD_HR],
  [
    "MANAGER",
    process.env.SEED_EMAIL_MANAGER ?? "maria@example.com",
    process.env.SEED_PASSWORD_MANAGER,
  ],
  [
    "EMPLOYEE",
    process.env.SEED_EMAIL_EMPLOYEE ?? "ana@example.com",
    process.env.SEED_PASSWORD_EMPLOYEE,
  ],
];

// 12 by default; lower it only for a throwaway demo (SEED_MIN_PASSWORD_LENGTH=8).
const minLength = Number(process.env.SEED_MIN_PASSWORD_LENGTH ?? 12);
for (const [label, , password] of accounts) {
  if (!password || password.length < minLength) {
    console.error(`SEED_PASSWORD_${label} must be set and at least ${minLength} characters.`);
    process.exit(1);
  }
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

for (const [label, email, password] of accounts) {
  const { error } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
  });
  if (!error) console.log(`${label}: created ${email}`);
  else if (/already|registered|exists/i.test(error.message))
    console.log(`${label}: ${email} already exists, skipped`);
  else {
    console.error(`${label}: could not create ${email} (${error.status ?? "error"})`);
    process.exitCode = 1;
  }
}
