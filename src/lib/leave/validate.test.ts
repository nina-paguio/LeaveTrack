import { describe, expect, it } from "vitest";
import {
  decideLeaveRequestSchema,
  submitLeaveRequestSchema,
  auditQuerySchema,
} from "@/lib/leave/validate";

const valid = {
  leaveTypeId: "6f1c2a3e-8b4d-4e5f-9a6b-1c2d3e4f5a6b",
  startDate: "2026-11-02",
  endDate: "2026-11-04",
  reason: "Family trip",
};

const messageFor = (input: unknown) => {
  const r = submitLeaveRequestSchema.safeParse(input);
  return r.success ? null : r.error.issues[0]?.message;
};

describe("submitLeaveRequestSchema", () => {
  it("accepts a valid request, including a one-day range", () => {
    expect(submitLeaveRequestSchema.safeParse(valid).success).toBe(true);
    expect(submitLeaveRequestSchema.safeParse({ ...valid, endDate: valid.startDate }).success).toBe(
      true,
    );
  });

  it("AC2: rejects an end date before the start date", () => {
    expect(messageFor({ ...valid, startDate: "2026-11-05", endDate: "2026-11-04" })).toBe(
      "End date cannot be before the start date.",
    );
  });

  it("rejects malformed or impossible dates", () => {
    expect(messageFor({ ...valid, startDate: "11/02/2026" })).toMatch(/YYYY-MM-DD/);
    expect(messageFor({ ...valid, endDate: "2026-02-31" })).toBe("Enter a valid date.");
  });

  it("rejects a missing or non-UUID leave type", () => {
    expect(messageFor({ ...valid, leaveTypeId: "lt-vacation" })).toBe("Choose a leave type.");
    expect(messageFor({ ...valid, leaveTypeId: undefined })).toBeTruthy();
  });

  it("requires a reason and caps its length", () => {
    expect(messageFor({ ...valid, reason: "   " })).toBe("A reason is required.");
    expect(messageFor({ ...valid, reason: "x".repeat(501) })).toMatch(/under 500/);
  });
});

describe("decideLeaveRequestSchema", () => {
  const msg = (input: unknown) => {
    const r = decideLeaveRequestSchema.safeParse(input);
    return r.success ? null : r.error.issues[0]?.message;
  };

  it("accepts approve with or without a reason", () => {
    expect(decideLeaveRequestSchema.safeParse({ decision: "approve" }).success).toBe(true);
    expect(decideLeaveRequestSchema.safeParse({ decision: "approve", reason: "ok" }).success).toBe(
      true,
    );
  });

  it("accepts reject only with a reason", () => {
    expect(
      decideLeaveRequestSchema.safeParse({ decision: "reject", reason: "No cover" }).success,
    ).toBe(true);
    expect(msg({ decision: "reject" })).toBe("A reason is required to reject.");
    expect(msg({ decision: "reject", reason: "" })).toBe("A reason is required to reject.");
    expect(msg({ decision: "reject", reason: "   " })).toBe("A reason is required to reject.");
  });

  it("rejects an unknown decision and an over-long reason", () => {
    expect(msg({ decision: "maybe" })).toBe("Decision must be approve or reject.");
    expect(msg({})).toBeTruthy();
    expect(msg({ decision: "reject", reason: "x".repeat(501) })).toMatch(/under 500/);
  });

  it("trims the reason", () => {
    const r = decideLeaveRequestSchema.safeParse({ decision: "reject", reason: "  No cover  " });
    expect(r.success && r.data.reason).toBe("No cover");
  });
});

describe("auditQuerySchema", () => {
  const msg = (input: unknown) => {
    const r = auditQuerySchema.safeParse(input);
    return r.success ? null : r.error.issues[0]?.message;
  };

  it("accepts no range, an open range and a full range", () => {
    expect(auditQuerySchema.safeParse({}).success).toBe(true);
    expect(auditQuerySchema.safeParse({ from: "2026-01-01" }).success).toBe(true);
    expect(auditQuerySchema.safeParse({ to: "2026-12-31" }).success).toBe(true);
    expect(auditQuerySchema.safeParse({ from: "2026-01-01", to: "2026-01-01" }).success).toBe(true);
  });

  it("rejects from after to, and malformed or impossible dates", () => {
    expect(msg({ from: "2026-12-31", to: "2026-01-01" })).toBe(
      "The from date cannot be after the to date.",
    );
    expect(msg({ from: "11/02/2026" })).toMatch(/YYYY-MM-DD/);
    expect(msg({ to: "2026-02-31" })).toBe("Enter a valid date.");
  });
});
