import { describe, expect, it } from "vitest";
import { auditHref } from "@/lib/leave/audit-query";

describe("auditHref", () => {
  it("builds the URL from the filters and leaves out anything empty", () => {
    expect(auditHref({})).toBe("/audit");
    expect(auditHref({ userId: "u-1" })).toBe("/audit?userId=u-1");
    expect(auditHref({ userId: "u-1", from: "2026-01-01", to: "2026-12-31" })).toBe(
      "/audit?userId=u-1&from=2026-01-01&to=2026-12-31",
    );
    expect(auditHref({ userId: "u-1", from: "", to: "" })).toBe("/audit?userId=u-1");
  });

  it("encodes values so a crafted filter cannot add parameters", () => {
    expect(auditHref({ userId: "a&page=9" })).toBe("/audit?userId=a%26page%3D9");
  });
});
