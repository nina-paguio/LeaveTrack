import { describe, expect, it, vi } from "vitest";
import {
  authenticate,
  authenticateGoogle,
  MAX_PASSWORD_LENGTH,
  type AuthDeps,
  type GoogleAuthDeps,
} from "@/lib/auth/authenticate";
import { classifyPasswordError } from "@/lib/auth/password-errors";
import type { Role } from "@/types/domain";

function deps(over: Partial<AuthDeps> = {}): AuthDeps & {
  verifyPassword: ReturnType<typeof vi.fn>;
  resolveRole: ReturnType<typeof vi.fn>;
} {
  return {
    verifyPassword: vi.fn(async (email: string) => email),
    resolveRole: vi.fn(async (): Promise<Role | null> => "manager"),
    ...over,
  } as never;
}

const REFUSED = { ok: false, reason: "refused" } as const;

describe("authenticate", () => {
  it("signs in with the role from the users table", async () => {
    const d = deps();
    expect(await authenticate(d, " Maria@Example.com ", "correct horse")).toEqual({
      ok: true,
      email: "maria@example.com",
      role: "manager",
    });
    expect(d.verifyPassword).toHaveBeenCalledWith("maria@example.com", "correct horse");
    expect(d.resolveRole).toHaveBeenCalledWith("maria@example.com");
  });

  it("refuses a wrong password and an unknown email with the same result, never reaching users", async () => {
    const d = deps({ verifyPassword: vi.fn(async () => null) });
    expect(await authenticate(d, "maria@example.com", "wrong")).toEqual(REFUSED);
    expect(d.resolveRole).not.toHaveBeenCalled();
  });

  it("refuses a verified account that has no users row, identical to a wrong password", async () => {
    const d = deps({ resolveRole: vi.fn(async () => null) });
    expect(await authenticate(d, "stranger@example.com", "pw")).toEqual(REFUSED);
  });

  it("takes the role only from users: nothing the provider returns can set it", async () => {
    const d = deps({ resolveRole: vi.fn(async () => "employee" as Role) });
    const result = await authenticate(d, "ana@example.com", "pw");
    expect(result).toMatchObject({ ok: true, role: "employee" });
  });

  it("refuses bad input without calling the provider", async () => {
    const d = deps();
    for (const [email, password] of [
      ["", "pw"],
      ["not-an-email", "pw"],
      ["a@b.co", ""],
      ["a@b.co", undefined],
      ["a@b.co", 12345],
      ["a@b.co", "x".repeat(MAX_PASSWORD_LENGTH + 1)],
      [`${"a".repeat(250)}@b.co`, "pw"],
    ] as const) {
      expect(await authenticate(d, email, password), String(email)).toEqual(REFUSED);
    }
    expect(d.verifyPassword).not.toHaveBeenCalled();
  });

  it("enforces the optional domain restriction exactly", async () => {
    const d = deps();
    expect(await authenticate(d, "ana@example.com", "pw", "example.com")).toMatchObject({
      ok: true,
    });
    for (const email of ["ana@evil.io", "ana@mail.example.com", "ana@example.com.evil.io"]) {
      expect(await authenticate(d, email, "pw", "example.com"), email).toEqual(REFUSED);
    }
  });

  it("reports unavailable, not refused, when the provider or the database fails", async () => {
    const down = deps({ verifyPassword: vi.fn(async () => Promise.reject(new Error("net"))) });
    expect(await authenticate(down, "a@b.co", "pw")).toEqual({ ok: false, reason: "unavailable" });
    const db = deps({ resolveRole: vi.fn(async () => Promise.reject(new Error("db"))) });
    expect(await authenticate(db, "a@b.co", "pw")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("never puts the password in its result", async () => {
    const result = await authenticate(deps(), "ana@example.com", "S3cret-pass-phrase");
    expect(JSON.stringify(result)).not.toContain("S3cret-pass-phrase");
  });
});

describe("classifyPasswordError", () => {
  it("treats credential problems as refused and outages as unavailable", () => {
    expect(classifyPasswordError({ status: 400, code: "invalid_credentials" })).toBe("refused");
    expect(classifyPasswordError({ status: 400, code: "email_not_confirmed" })).toBe("refused");
    expect(classifyPasswordError({ status: 429 })).toBe("refused");
    expect(classifyPasswordError({ status: 500 })).toBe("unavailable");
    expect(classifyPasswordError({ status: 503 })).toBe("unavailable");
    expect(classifyPasswordError({ status: 0 })).toBe("unavailable");
    expect(classifyPasswordError({})).toBe("unavailable");
  });
});

describe("authenticateGoogle", () => {
  const google = (over: Partial<GoogleAuthDeps> = {}) =>
    ({
      exchangeCode: vi.fn(async () => ({ email: "Maria@Example.com", emailVerified: true })),
      resolveRole: vi.fn(async (): Promise<Role | null> => "manager"),
      ...over,
    }) as GoogleAuthDeps & {
      exchangeCode: ReturnType<typeof vi.fn>;
      resolveRole: ReturnType<typeof vi.fn>;
    };

  it("signs in with the role from the users table", async () => {
    const d = google();
    expect(await authenticateGoogle(d, "code-1", "verifier-1")).toEqual({
      ok: true,
      email: "maria@example.com",
      role: "manager",
    });
    expect(d.exchangeCode).toHaveBeenCalledWith("code-1", "verifier-1");
    expect(d.resolveRole).toHaveBeenCalledWith("maria@example.com");
  });

  it("refuses without a code or without this browser's verifier, and never calls Google", async () => {
    const d = google();
    for (const [code, verifier] of [
      [null, "v"],
      ["", "v"],
      ["c", undefined],
      ["c", ""],
      [42, "v"],
    ] as const) {
      expect(await authenticateGoogle(d, code, verifier)).toEqual(REFUSED);
    }
    expect(d.exchangeCode).not.toHaveBeenCalled();
    expect(d.resolveRole).not.toHaveBeenCalled();
  });

  it("refuses an email Google has not verified, before the users table is read", async () => {
    const d = google({
      exchangeCode: vi.fn(async () => ({ email: "a@example.com", emailVerified: false })),
    });
    expect(await authenticateGoogle(d, "c", "v")).toEqual(REFUSED);
    expect(d.resolveRole).not.toHaveBeenCalled();
  });

  it("refuses a code that was not accepted", async () => {
    const d = google({ exchangeCode: vi.fn(async () => null) });
    expect(await authenticateGoogle(d, "c", "v")).toEqual(REFUSED);
    expect(d.resolveRole).not.toHaveBeenCalled();
  });

  it("refuses a Google account that is not in the users table (a Google account is never enough)", async () => {
    const d = google({ resolveRole: vi.fn(async () => null) });
    expect(await authenticateGoogle(d, "c", "v")).toEqual(REFUSED);
  });

  it("enforces the company domain exactly when one is set", async () => {
    const d = google({
      exchangeCode: vi.fn(async () => ({ email: "a@gmail.com", emailVerified: true })),
    });
    expect(await authenticateGoogle(d, "c", "v", "example.com")).toEqual(REFUSED);
    expect(d.resolveRole).not.toHaveBeenCalled();
    const ok = google({
      exchangeCode: vi.fn(async () => ({ email: "a@example.com", emailVerified: true })),
    });
    expect((await authenticateGoogle(ok, "c", "v", "example.com")).ok).toBe(true);
    const lookalike = google({
      exchangeCode: vi.fn(async () => ({ email: "a@evil-example.com", emailVerified: true })),
    });
    expect(await authenticateGoogle(lookalike, "c", "v", "example.com")).toEqual(REFUSED);
  });

  it("reports unavailable (not refused) when Google or the database cannot be reached", async () => {
    const down = google({ exchangeCode: vi.fn(async () => Promise.reject(new Error("down"))) });
    expect(await authenticateGoogle(down, "c", "v")).toEqual({ ok: false, reason: "unavailable" });
    const noDb = google({ resolveRole: vi.fn(async () => Promise.reject(new Error("no db"))) });
    expect(await authenticateGoogle(noDb, "c", "v")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("takes the role only from the users table, never from anything the provider returns", async () => {
    const d = google({
      exchangeCode: vi.fn(async () => ({
        email: "a@example.com",
        emailVerified: true,
        role: "hr_admin",
      })),
      resolveRole: vi.fn(async (): Promise<Role | null> => "employee"),
    });
    expect(await authenticateGoogle(d, "c", "v")).toMatchObject({ role: "employee" });
  });
});
