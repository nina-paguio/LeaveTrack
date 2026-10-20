# Test OAuth glue against a fake provider

Pure decision logic (`authenticateGoogle`) can be unit-tested with fakes, but the glue that talks to the
real SDK cannot: the first version of `lib/supabase/oauth.ts` passed lint, types and every unit test, yet
failed on the first exchange ("PKCE code verifier not found") because supabase-js stores the verifier per
flow and the code was replaying the wrong key.

Pattern: run the real client against a tiny in-process `node:http` server that mimics the provider's
endpoints (see `src/lib/supabase/oauth.test.ts`) and assert the full start -> exchange -> revoke path,
including the refusal cases (wrong code, mismatched verifier, 5xx).
