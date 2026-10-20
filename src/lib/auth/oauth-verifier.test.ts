import { describe, expect, it } from "vitest";
import { parseVerifier, serializeVerifier } from "@/lib/auth/oauth-verifier";

const entry = { key: "sb-abc-auth-token-code-verifier", value: "verifier-123/PASSWORD_RECOVERY" };

describe("oauth verifier cookie", () => {
  it("round-trips an entry", () => {
    expect(parseVerifier(serializeVerifier(entry))).toEqual(entry);
  });

  it("rejects a missing, empty or garbage value", () => {
    expect(parseVerifier(undefined)).toBeNull();
    expect(parseVerifier("")).toBeNull();
    expect(parseVerifier("not base64 json!!")).toBeNull();
    expect(parseVerifier(Buffer.from("[]").toString("base64url"))).toBeNull();
    expect(parseVerifier(Buffer.from("null").toString("base64url"))).toBeNull();
  });

  it("only accepts a code-verifier storage key, so the cookie cannot seed any other key", () => {
    expect(parseVerifier(serializeVerifier({ key: "sb-abc-auth-token", value: "x" }))).toBeNull();
    expect(parseVerifier(serializeVerifier({ key: "", value: "x" }))).toBeNull();
  });

  it("rejects an empty or oversized value", () => {
    expect(parseVerifier(serializeVerifier({ ...entry, value: "" }))).toBeNull();
    expect(parseVerifier(serializeVerifier({ ...entry, value: "x".repeat(600) }))).toBeNull();
  });
});
