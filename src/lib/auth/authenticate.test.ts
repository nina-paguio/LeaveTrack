import { describe, expect, it, vi } from "vitest";
import { authenticate, MAX_PASSWORD_LENGTH, type AuthDeps } from "@/lib/auth/authenticate";
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
