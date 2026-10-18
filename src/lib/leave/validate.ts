import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be in YYYY-MM-DD format.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid date.");

/** Server-side validation for POST /api/leave-requests (US-01). */
export const submitLeaveRequestSchema = z
  .object({
    leaveTypeId: z.uuid("Choose a leave type."),
    startDate: isoDate,
    endDate: isoDate,
    reason: z
      .string()
      .trim()
      .min(1, "A reason is required.")
      .max(500, "Keep the reason under 500 characters."),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date cannot be before the start date.",
    path: ["endDate"],
  });

export type SubmitLeaveRequestInput = z.infer<typeof submitLeaveRequestSchema>;

/** Body for POST /api/leave-requests/:id/decision (US-03). A rejection must say why. */
export const decideLeaveRequestSchema = z
  .object({
    decision: z.enum(["approve", "reject"], "Decision must be approve or reject."),
    reason: z.string().trim().max(500, "Keep the reason under 500 characters.").optional(),
  })
  .refine((v) => v.decision !== "reject" || (v.reason !== undefined && v.reason.length > 0), {
    message: "A reason is required to reject.",
    path: ["reason"],
  });

export type DecideLeaveRequestInput = z.infer<typeof decideLeaveRequestSchema>;

/** Optional range for GET /api/audit/:userId (US-05): leave dates that overlap [from, to]. */
export const auditQuerySchema = z
  .object({ from: isoDate.optional(), to: isoDate.optional() })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: "The from date cannot be after the to date.",
    path: ["to"],
  });

export type AuditQuery = z.infer<typeof auditQuerySchema>;
