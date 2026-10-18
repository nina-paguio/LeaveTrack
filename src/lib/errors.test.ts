import { describe, expect, it } from "vitest";
import { AppError, errorBody, errorResponse, toErrorResponse } from "@/lib/errors";

describe("error envelope", () => {
  it("matches { success: false, error: { code, message } }", () => {
    expect(errorBody("FORBIDDEN", "nope")).toEqual({
      success: false,
      error: { code: "FORBIDDEN", message: "nope" },
    });
  });

  it("sets the status on the response", async () => {
    const res = errorResponse("NOT_FOUND", "missing", 404);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "missing" },
    });
  });

  it("maps AppError to its status and hides unknown errors", async () => {
    expect(toErrorResponse(new AppError("FORBIDDEN", "x", 403)).status).toBe(403);
    const res = toErrorResponse(new Error("db password is hunter2"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
  });
});
