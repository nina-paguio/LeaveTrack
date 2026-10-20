// @vitest-environment node
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let base = "";
const mockEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  GOOGLE_SIGN_IN_ENABLED: "true",
};
vi.mock("@/lib/env", () => ({ env: mockEnv }));

// A tiny stand-in for Supabase Auth: accepts a code only with the verifier that matches the challenge.
let identity: Record<string, unknown> = {};
let challenge = "";
let tokenStatus = 200;
let loggedOut = false;
let server: Server;

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (url.pathname === "/auth/v1/token") {
        const { code_verifier: v, auth_code: code } = JSON.parse(body || "{}");
        const ok =
          tokenStatus === 200 &&
          code === "good-code" &&
          createHash("sha256").update(String(v)).digest("base64url") === challenge;
        if (!ok) {
          res.statusCode = tokenStatus === 200 ? 400 : tokenStatus;
          res.end(JSON.stringify({ code: res.statusCode, error_code: "bad", msg: "bad code" }));
          return;
        }
        res.end(
          JSON.stringify({
            access_token: "a.b.c",
            token_type: "bearer",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            refresh_token: "r",
            user: { id: "u1", aud: "authenticated", email: "someone@else.test", identities: [identity] },
          }),
        );
      } else if (url.pathname === "/auth/v1/logout") {
        loggedOut = true;
        res.statusCode = 204;
        res.end();
      } else {
        res.statusCode = 404;
        res.end("{}");
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  mockEnv.NEXT_PUBLIC_SUPABASE_URL = base;
});
afterAll(() => server.close());

async function begin() {
  const { startGoogleSignIn } = await import("@/lib/supabase/oauth");
  const started = await startGoogleSignIn("http://localhost:3000/api/auth/google/callback");
  challenge = new URL(started.url).searchParams.get("code_challenge") ?? "";
  return started;
}

describe("Google sign-in against a fake Supabase", () => {
  it("starts with PKCE and returns the verifier to carry", async () => {
    const started = await begin();
    const url = new URL(started.url);
    expect(url.origin).toBe(base);
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("code_challenge_method")).toBe("s256");
    expect(started.verifier.key.endsWith("-code-verifier")).toBe(true);
  });

  it("trades the code for the GOOGLE identity's email, not the account's other fields, and revokes the session", async () => {
    identity = { provider: "google", identity_data: { email: "maria@example.com", email_verified: true } };
    loggedOut = false;
    const { exchangeGoogleCode } = await import("@/lib/supabase/oauth");
    const started = await begin();
    expect(await exchangeGoogleCode("good-code", started.verifier)).toEqual({
      email: "maria@example.com",
      emailVerified: true,
    });
    expect(loggedOut).toBe(true);
  });

  it("reports an email Google did not verify as unverified", async () => {
    identity = { provider: "google", identity_data: { email: "maria@example.com", email_verified: false } };
    const { exchangeGoogleCode } = await import("@/lib/supabase/oauth");
    const started = await begin();
    expect((await exchangeGoogleCode("good-code", started.verifier))?.emailVerified).toBe(false);
  });

  it("refuses an account with no Google identity", async () => {
    identity = { provider: "email", identity_data: { email: "maria@example.com", email_verified: true } };
    const { exchangeGoogleCode } = await import("@/lib/supabase/oauth");
    const started = await begin();
    expect(await exchangeGoogleCode("good-code", started.verifier)).toBeNull();
  });

  it("returns null for a code Supabase rejects, and for a verifier that does not match", async () => {
    identity = { provider: "google", identity_data: { email: "maria@example.com", email_verified: true } };
    const { exchangeGoogleCode } = await import("@/lib/supabase/oauth");
    const started = await begin();
    expect(await exchangeGoogleCode("wrong-code", started.verifier)).toBeNull();
    const other = await begin(); // a different browser's verifier, but this browser's challenge
    challenge = new URL(started.url).searchParams.get("code_challenge") ?? "";
    expect(await exchangeGoogleCode("good-code", other.verifier)).toBeNull();
  });

  it("throws (unavailable, not refused) when Supabase answers with a server error", async () => {
    identity = { provider: "google", identity_data: { email: "maria@example.com", email_verified: true } };
    const { exchangeGoogleCode } = await import("@/lib/supabase/oauth");
    const started = await begin();
    tokenStatus = 503;
    try {
      await expect(exchangeGoogleCode("good-code", started.verifier)).rejects.toThrow();
    } finally {
      tokenStatus = 200;
    }
  });
});
