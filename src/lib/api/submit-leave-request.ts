import type { SubmitResult } from "@/lib/leave/submit";

export interface SubmitLeaveRequestBody {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

/** Client-side call to POST /api/leave-requests. Throws an Error carrying the server's message. */
export async function postLeaveRequest(body: SubmitLeaveRequestBody): Promise<SubmitResult> {
  const res = await fetch("/api/leave-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const json: unknown = await res.json().catch(() => null);
  const payload = json as
    { success: true; data: SubmitResult } | { success: false; error: { message: string } } | null;

  if (!res.ok || !payload || payload.success !== true) {
    const message = payload && payload.success === false ? payload.error.message : undefined;
    throw new Error(message ?? "Could not submit the request. Please try again.");
  }
  return payload.data;
}
