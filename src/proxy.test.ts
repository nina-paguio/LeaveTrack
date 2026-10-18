import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie } } : undefined);

// NextResponse.next() marks itself with this header; redirects and JSON errors do not carry it.
const passesThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("proxy: public paths (no login cookie)", () => {
  it("lets the login page and the health check through", () => {
    expect(passesThrough(proxy(req("/login")))).toBe(true);
    expect(passesThrough(proxy(req("/api/health")))).toBe(true);
  });

  it("lets exactly /api/jobs/accrual through, because Vercel Cron has no cookie", () => {
    expect(passesThrough(proxy(req("/api/jobs/accrual")))).toBe(true);
  });

  it("does NOT open anything else under /api/jobs or nearby", async () => {
    for (const path of [
      "/api/jobs",
      "/api/jobs/",
      "/api/jobs/other",
      "/api/jobs/accrual/extra",
      "/api/jobs/accrual/",
      "/api/jobs/accrualx",
      "/api/jobs/ACCRUAL",
      "/api/jobs/../leave-requests",
    ]) {
      const res = proxy(req(path));
      expect(passesThrough(res), path).toBe(false);
      expect(res.status, path).toBe(401);
      expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
    }
  });

  it("still protects the rest of the API and the pages", () => {
    expect(proxy(req("/api/leave-requests")).status).toBe(401);
    expect(proxy(req("/api/audit/6f1c2a3e-8b4d-4e5f-9a6b-1c2d3e4f5a6b")).status).toBe(401);
    const page = proxy(req("/dashboard"));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toBe("http://localhost/login");
  });
});

describe("proxy: signed-in behaviour is unchanged", () => {
  it("passes an employee to their pages and blocks the HR API", () => {
    expect(passesThrough(proxy(req("/leave/balance", "mock-role=employee")))).toBe(true);
    expect(
      proxy(req("/api/audit/6f1c2a3e-8b4d-4e5f-9a6b-1c2d3e4f5a6b", "mock-role=employee")).status,
    ).toBe(403);
  });
});
