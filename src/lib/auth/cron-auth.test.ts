import { describe, expect, it } from "vitest";
import { hasValidCronSecret } from "@/lib/auth/cron-auth";

const SECRET = "test-cron-secret-0123456789abcdef";
const req = (authorization?: string) =>
  new Request("http://localhost/api/jobs/x", {
    headers: authorization === undefined ? {} : { authorization },
  });

describe("hasValidCronSecret", () => {
  it("accepts exactly the bearer secret", () => {
    expect(hasValidCronSecret(req(`Bearer ${SECRET}`), SECRET)).toBe(true);
  });

  it.each([
    ["no header", undefined],
    ["wrong secret", "Bearer nope"],
    ["longer", `Bearer ${SECRET}x`],
    ["shorter", `Bearer ${SECRET.slice(0, -1)}`],
    ["one byte different", `Bearer ${SECRET.slice(0, -1)}!`],
    ["empty bearer", "Bearer "],
    ["no scheme", SECRET],
    ["Basic scheme", `Basic ${SECRET}`],
    ["lowercase scheme", `bearer ${SECRET}`],
  ])("refuses %s", (_label, header) => {
    expect(hasValidCronSecret(req(header), SECRET)).toBe(false);
  });
});
