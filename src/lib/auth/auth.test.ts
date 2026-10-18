import { describe, expect, it } from "vitest";
import { isCompanyEmail, isPlausibleEmail, normalizeEmail } from "@/lib/auth/email";
import {
  clearAttempts,
  MAX_ATTEMPTS,
  resetAttempts,
  tooManyAttempts,
  WINDOW_MS,
} from "@/lib/auth/rate-limit";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session-token";

const SECRET = "x".repeat(32);
const claims = { email: "ana@stratpoint.com", role: "employee" } as const;

describe("session token", () => {
  it("round-trips valid claims", () => {
    const t = createSessionToken(claims, SECRET, 60);
    expect(verifySessionToken(t, SECRET)).toEqual(claims);
  });

  it("rejects a wrong secret, a short secret, garbage and expiry", () => {
    const t = createSessionToken(claims, SECRET, 60, 1_000_000);
    expect(verifySessionToken(t, "y".repeat(32), 1_000_000)).toBeNull();
    expect(verifySessionToken(t, "short", 1_000_000)).toBeNull();
    expect(verifySessionToken(undefined, SECRET)).toBeNull();
    expect(verifySessionToken("employee", SECRET)).toBeNull();
    expect(verifySessionToken("a.b.c", SECRET)).toBeNull();
    expect(verifySessionToken(t, SECRET, 1_000_000 + 61_000)).toBeNull();
  });

  it("rejects a payload whose role was edited", () => {
    const [body = "", mac = ""] = createSessionToken(claims, SECRET, 60).split(".");
    const edited = JSON.parse(Buffer.from(body, "base64url").toString());
    edited.r = "hr_admin";
    const forged = Buffer.from(JSON.stringify(edited)).toString("base64url");
    expect(verifySessionToken(`${forged}.${mac}`, SECRET)).toBeNull();
  });
});

describe("company email", () => {
  it("normalizes case and spaces", () => {
    expect(normalizeEmail("  Ana@StratPoint.com ")).toBe("ana@stratpoint.com");
    expect(normalizeEmail(null)).toBe("");
  });

  it("recognises a plausible address without a domain rule", () => {
    expect(isPlausibleEmail("ana@example.com")).toBe(true);
    expect(isPlausibleEmail("ana@")).toBe(false);
    expect(isPlausibleEmail("a b@example.com")).toBe(false);
    expect(isPlausibleEmail(`${"a".repeat(250)}@b.co`)).toBe(false);
  });

  it("accepts only the exact domain", () => {
    const d = "stratpoint.com";
    expect(isCompanyEmail("ana@stratpoint.com", d)).toBe(true);
    for (const bad of [
      "ana@gmail.com",
      "ana@stratpoint.com.evil.io",
      "ana@mail.stratpoint.com",
      "ana@notstratpoint.com",
      "ana@stratpoint.com@evil.io",
      "ana stratpoint.com",
      "@stratpoint.com",
      "",
    ]) {
      expect(isCompanyEmail(bad, d), bad).toBe(false);
    }
    expect(isCompanyEmail("ana@stratpoint.com", undefined)).toBe(false);
  });
});

describe("rate limit", () => {
  it("blocks after the maximum and recovers after the window", () => {
    resetAttempts();
    for (let i = 0; i < MAX_ATTEMPTS; i++) expect(tooManyAttempts("ip", 1000)).toBe(false);
    expect(tooManyAttempts("ip", 1000)).toBe(true);
    expect(tooManyAttempts("other", 1000)).toBe(false);
    expect(tooManyAttempts("ip", 1000 + WINDOW_MS + 1)).toBe(false);
  });

  it("does not count a sign-in that succeeded once its keys are cleared", () => {
    resetAttempts();
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) tooManyAttempts("ip", 1000);
    clearAttempts("ip");
    for (let i = 0; i < MAX_ATTEMPTS; i++) expect(tooManyAttempts("ip", 1000)).toBe(false);
  });
});
