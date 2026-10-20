import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { createSessionToken } from "@/lib/auth/session-token";
import { env } from "@/lib/env";
import { proxy } from "@/proxy";

const cookieFor = (role: "employee" | "manager" | "hr_admin") =>
  `${env.SESSION_COOKIE_NAME}=${createSessionToken({ email: `${role}@x.test`, role }, env.SESSION_SECRET ?? "", 3600)}`;

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie } } : undefined);

// NextResponse.next() marks itself with this header; redirects and JSON errors do not carry it.
const passesThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("proxy: public paths (no login cookie)", () => {
  it("lets the login page and the health check through", () => {
    expect(passesThrough(proxy(req("/login")))).toBe(true);
    expect(passesThrough(proxy(req("/api/health")))).toBe(true);
  });

  it("lets exactly the two cron job paths through, because Vercel Cron has no cookie", () => {
    expect(passesThrough(proxy(req("/api/jobs/accrual")))).toBe(true);
    expect(passesThrough(proxy(req("/api/jobs/retention")))).toBe(true);
  });

  it("lets exactly the two Google sign-in paths through, because the person has no session yet", () => {
    expect(passesThrough(proxy(req("/api/auth/google")))).toBe(true);
    expect(passesThrough(proxy(req("/api/auth/google/callback")))).toBe(true);
  });

  it("does NOT open anything else under /api/auth or nearby", async () => {
    for (const path of [
      "/api/auth",
      "/api/auth/",
      "/api/auth/other",
      "/api/auth/google/",
      "/api/auth/google/extra",
      "/api/auth/google/callback/extra",
      "/api/auth/googlex",
      "/api/auth/GOOGLE",
    ]) {
      const res = proxy(req(path));
      expect(passesThrough(res), path).toBe(false);
      expect(res.status, path).toBe(401);
    }
  });

  it("does NOT open anything else under /api/jobs or nearby", async () => {
    for (const path of [
      "/api/jobs",
      "/api/jobs/",
      "/api/jobs/other",
      "/api/jobs/accrual/extra",
      "/api/jobs/accrual/",
      "/api/jobs/accrualx",
      "/api/jobs/retention/extra",
      "/api/jobs/retention/",
      "/api/jobs/retentionx",
      "/api/jobs/RETENTION",
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

describe("proxy: signed-in landing pages", () => {
  it("sends each role from /, /login and the removed /dashboard to its own home", () => {
    const homes = {
      employee: "/leave/balance",
      manager: "/team/requests",
      hr_admin: "/audit",
    } as const;
    for (const [role, home] of Object.entries(homes)) {
      for (const path of ["/", "/login", "/dashboard"]) {
        const res = proxy(req(path, cookieFor(role as "employee" | "manager" | "hr_admin")));
        expect(res.status, `${role} ${path}`).toBe(307);
        expect(res.headers.get("location")).toBe(`http://localhost${home}`);
      }
    }
  });

  it("keeps HR out of /notifications and sends them to their own home", () => {
    const res = proxy(req("/notifications", cookieFor("hr_admin")));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/audit");
  });

  it("lets employees and managers open /notifications", () => {
    expect(passesThrough(proxy(req("/notifications", cookieFor("employee"))))).toBe(true);
    expect(passesThrough(proxy(req("/notifications", cookieFor("manager"))))).toBe(true);
  });

  it("sends a role away from a page it may not open to its own home", () => {
    const res = proxy(req("/leave/new", cookieFor("manager")));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/team/requests");
  });
});

describe("proxy: signed-in behaviour is unchanged", () => {
  it("passes an employee to their pages and blocks the HR API", () => {
    expect(passesThrough(proxy(req("/leave/balance", cookieFor("employee"))))).toBe(true);
    expect(
      proxy(req("/api/audit/6f1c2a3e-8b4d-4e5f-9a6b-1c2d3e4f5a6b", cookieFor("employee"))).status,
    ).toBe(403);
  });
});

describe("proxy: forged cookies are signed out", () => {
  it("rejects a bare role, an edited role and a tampered payload", async () => {
    const good = cookieFor("employee");
    const [body = "", mac = ""] = (good.split("=")[1] ?? "").split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ e: "a@b.test", r: "hr_admin", x: 9999999999 }),
    ).toString("base64url");
    for (const cookie of [
      `${env.SESSION_COOKIE_NAME}=hr_admin`,
      `${env.SESSION_COOKIE_NAME}=${forgedBody}.${mac}`,
      `${env.SESSION_COOKIE_NAME}=${body}.AAAA`,
    ]) {
      const res = proxy(req("/api/leave-requests", cookie));
      expect(res.status, cookie).toBe(401);
    }
  });
});
