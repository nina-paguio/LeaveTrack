import { describe, expect, it } from "vitest";
import { canAccess, isRole, navFor } from "@/lib/roles";
import { teamRequestsFor } from "@/mocks/data";

describe("roles", () => {
  it("accepts only known roles", () => {
    expect(isRole("manager")).toBe(true);
    expect(isRole("admin")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });

  it("gates routes by role", () => {
    expect(canAccess("/team/requests", "manager")).toBe(true);
    expect(canAccess("/team/requests", "employee")).toBe(false);
    expect(canAccess("/team/requests/r-1", "hr_admin")).toBe(false);
    expect(canAccess("/audit", "hr_admin")).toBe(true);
    // the audit API is HR-only at the proxy too (defence in depth behind the route check)
    expect(canAccess("/api/audit/6f1c2a3e-8b4d-4e5f-9a6b-1c2d3e4f5a6b", "hr_admin")).toBe(true);
    expect(canAccess("/api/audit/6f1c2a3e-8b4d-4e5f-9a6b-1c2d3e4f5a6b", "manager")).toBe(false);
    expect(canAccess("/api/audit/6f1c2a3e-8b4d-4e5f-9a6b-1c2d3e4f5a6b", "employee")).toBe(false);
    expect(canAccess("/api/auditing", "employee")).toBe(true);
    expect(canAccess("/audit", "manager")).toBe(false);
    expect(canAccess("/leave/new", "employee")).toBe(true);
    expect(canAccess("/leave/new", "hr_admin")).toBe(false);
    expect(canAccess("/dashboard", "employee")).toBe(true);
    // prefix match must not leak: "/auditing" is not "/audit"
    expect(canAccess("/auditing", "employee")).toBe(true);
  });

  it("only links to routes the role may open", () => {
    for (const role of ["employee", "manager", "hr_admin"] as const) {
      for (const item of navFor(role)) expect(canAccess(item.href, role)).toBe(true);
    }
  });
});

describe("mock team scope", () => {
  it("returns only direct reports' requests", () => {
    const ids = teamRequestsFor("u-mgr1").map((r) => r.userId);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).not.toContain("u-emp4");
  });
});
