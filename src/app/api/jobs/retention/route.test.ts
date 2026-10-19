import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-cron-secret-0123456789abcdef0123456789abcdef0123456789abcdef";

const mockEnv = vi.hoisted(() => ({
  CRON_SECRET: undefined as string | undefined,
  LOG_LEVEL: "error",
  APP_ENV: "dev",
}));
const archiveExpired = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: mockEnv }));
// Replaces the server-only Supabase repo, so no database is touched.
vi.mock("@/lib/leave/repo", () => ({ createLeaveRepo: () => ({ archiveExpired }) }));

import { GET, POST } from "@/app/api/jobs/retention/route";

const call = (method: "GET" | "POST", authorization?: string) =>
  (method === "GET" ? GET : POST)(
    new Request("http://localhost/api/jobs/retention", {
      method,
      headers: authorization === undefined ? {} : { authorization },
    }),
  );

beforeEach(() => {
  mockEnv.CRON_SECRET = SECRET;
  archiveExpired.mockReset();
  archiveExpired.mockResolvedValue(2);
});
afterEach(() => vi.restoreAllMocks());

describe("/api/jobs/retention: authentication (fails closed)", () => {
  it.each(["GET", "POST"] as const)(
    "%s 401s with no Authorization header and runs nothing",
    async (m) => {
      const res = await call(m);
      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
      expect(archiveExpired).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["wrong secret", "Bearer not-the-secret"],
    ["a longer wrong secret", `Bearer ${SECRET}x`],
    ["a shorter wrong secret", `Bearer ${SECRET.slice(0, -1)}`],
    ["no scheme", SECRET],
  ])("401s for %s", async (_label, header) => {
    for (const m of ["GET", "POST"] as const) expect((await call(m, header)).status).toBe(401);
    expect(archiveExpired).not.toHaveBeenCalled();
  });

  it("503s and runs nothing when CRON_SECRET is not configured (never open by default)", async () => {
    mockEnv.CRON_SECRET = undefined;
    for (const header of [undefined, "Bearer anything", "Bearer undefined"]) {
      const res = await call("POST", header);
      expect(res.status).toBe(503);
      expect((await res.json()).error.message).toBe("Retention is not configured.");
    }
    expect(archiveExpired).not.toHaveBeenCalled();
  });
});

describe("/api/jobs/retention: the run", () => {
  it.each(["GET", "POST"] as const)(
    "%s with the secret archives and reports the count",
    async (m) => {
      const res = await call(m, `Bearer ${SECRET}`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.archived).toBe(2);
      expect(json.data.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(archiveExpired).toHaveBeenCalledTimes(1);
      expect(archiveExpired.mock.calls[0]).toEqual([json.data.asOf]);
    },
  );

  it("returns a generic 500 and never leaks the database error", async () => {
    archiveExpired.mockRejectedValue(new Error("connection string with secret"));
    const res = await call("POST", `Bearer ${SECRET}`);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
