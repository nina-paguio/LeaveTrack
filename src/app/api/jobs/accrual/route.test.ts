import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-cron-secret-0123456789abcdef0123456789abcdef0123456789abcdef";

const mockEnv = vi.hoisted(() => ({
  CRON_SECRET: undefined as string | undefined,
  LOG_LEVEL: "info",
  APP_ENV: "dev",
}));
const runMonthlyAccrual = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: mockEnv }));
// Replaces the server-only Supabase repo, so no database is touched.
vi.mock("@/lib/leave/repo", () => ({ createLeaveRepo: () => ({ runMonthlyAccrual }) }));

import { GET, POST } from "@/app/api/jobs/accrual/route";

const call = (method: "GET" | "POST", authorization?: string) =>
  (method === "GET" ? GET : POST)(
    new Request("http://localhost/api/jobs/accrual", {
      method,
      headers: authorization === undefined ? {} : { authorization },
    }),
  );

let written: string[] = [];

beforeEach(() => {
  mockEnv.CRON_SECRET = SECRET;
  runMonthlyAccrual.mockReset();
  runMonthlyAccrual.mockResolvedValue({
    month: "2026-10-01",
    accrued: 14,
    skipped: 0,
    alreadyRun: false,
  });
  written = [];
  vi.spyOn(process.stdout, "write").mockImplementation(
    (chunk) => (written.push(String(chunk)), true),
  );
  vi.spyOn(process.stderr, "write").mockImplementation(
    (chunk) => (written.push(String(chunk)), true),
  );
});

afterEach(() => vi.restoreAllMocks());

describe("/api/jobs/accrual: authentication (fails closed)", () => {
  it.each(["GET", "POST"] as const)(
    "%s 401s with no Authorization header and runs nothing",
    async (method) => {
      const res = await call(method);
      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
      expect(runMonthlyAccrual).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["wrong secret", "Bearer not-the-secret"],
    ["a longer wrong secret", `Bearer ${SECRET}x`],
    ["a shorter wrong secret", `Bearer ${SECRET.slice(0, -1)}`],
    ["same length, one byte different", `Bearer ${SECRET.slice(0, -1)}!`],
    ["empty bearer", "Bearer "],
    ["no scheme", SECRET],
    ["Basic scheme", `Basic ${SECRET}`],
    ["lowercase scheme", `bearer ${SECRET}`],
  ])("401s for %s without crashing (different lengths are fine)", async (_label, header) => {
    for (const method of ["GET", "POST"] as const) {
      const res = await call(method, header);
      expect(res.status).toBe(401);
    }
    expect(runMonthlyAccrual).not.toHaveBeenCalled();
  });

  it("503s and runs nothing when CRON_SECRET is not configured (never open by default)", async () => {
    mockEnv.CRON_SECRET = undefined;
    for (const header of [undefined, "Bearer anything", "Bearer ", "Bearer undefined"]) {
      const res = await call("POST", header);
      expect(res.status).toBe(503);
      expect((await res.json()).error.message).toBe("Accrual is not configured.");
    }
    expect(runMonthlyAccrual).not.toHaveBeenCalled();
  });

  it("treats an empty CRON_SECRET as not configured", async () => {
    mockEnv.CRON_SECRET = "";
    expect((await call("POST", "Bearer ")).status).toBe(503);
    expect(runMonthlyAccrual).not.toHaveBeenCalled();
  });
});

describe("/api/jobs/accrual: running", () => {
  it.each(["GET", "POST"] as const)(
    "%s runs the accrual for the current Manila month and returns the result",
    async (method) => {
      const res = await call(method, `Bearer ${SECRET}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        success: true,
        data: { month: "2026-10-01", accrued: 14, skipped: 0, alreadyRun: false },
      });
      expect(runMonthlyAccrual).toHaveBeenCalledTimes(1);
      expect(runMonthlyAccrual.mock.calls[0]?.[0]).toMatch(/^\d{4}-\d{2}-01$/);
    },
  );

  it("returns a repeat as a normal 200 with alreadyRun true (a duplicate cron delivery is not an error)", async () => {
    runMonthlyAccrual.mockResolvedValue({
      month: "2026-10-01",
      accrued: 0,
      skipped: 14,
      alreadyRun: true,
    });
    const res = await call("POST", `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ accrued: 0, alreadyRun: true });
  });

  it("returns a generic 500 when the database fails, with no internals", async () => {
    runMonthlyAccrual.mockRejectedValue(
      new Error("password authentication failed for user postgres.abc123"),
    );
    const res = await call("POST", `Bearer ${SECRET}`);
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).toContain("Something went wrong.");
    expect(text).not.toContain("password");
    expect(text).not.toContain("postgres");
  });
});

describe("/api/jobs/accrual: the secret never leaks", () => {
  it("is not in any response body or header, and not in any log line, on any path", async () => {
    const responses: Response[] = [];
    responses.push(await call("GET"));
    responses.push(await call("POST", `Bearer ${SECRET}x`));
    responses.push(await call("POST", `Bearer ${SECRET}`));
    runMonthlyAccrual.mockRejectedValueOnce(new Error("boom"));
    responses.push(await call("GET", `Bearer ${SECRET}`));
    mockEnv.CRON_SECRET = undefined;
    responses.push(await call("POST", `Bearer ${SECRET}`));

    for (const res of responses) {
      expect(await res.text()).not.toContain(SECRET);
      expect([...res.headers.values()].join(" ")).not.toContain(SECRET);
    }
    expect(written.join("\n")).not.toContain(SECRET);
    expect(written.length).toBeGreaterThan(0); // the failure paths did log something
  });
});
