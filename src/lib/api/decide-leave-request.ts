export type DecisionAction = "approve" | "reject";

/** Client-side call to POST /api/leave-requests/:id/decision. Throws an Error with the server's message. */
export async function postDecision(
  requestId: string,
  decision: DecisionAction,
  reason?: string,
): Promise<void> {
  const res = await fetch(`/api/leave-requests/${encodeURIComponent(requestId)}/decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision, reason }),
  });

  const json: unknown = await res.json().catch(() => null);
  const payload = json as { success: boolean; error?: { message: string } } | null;

  if (!res.ok || !payload || payload.success !== true) {
    throw new Error(payload?.error?.message ?? "Could not record the decision. Please try again.");
  }
}
