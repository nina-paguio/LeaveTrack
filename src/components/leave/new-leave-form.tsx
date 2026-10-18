"use client";

import {
  LeaveRequestForm,
  type LeaveRequestFormProps,
  type LeaveRequestValues,
  type SubmitOutcome,
} from "@/components/leave/leave-request-form";
import { postLeaveRequest } from "@/lib/api/submit-leave-request";

export interface NewLeaveFormProps extends Omit<LeaveRequestFormProps, "onSubmit"> {
  /** false when no database is configured: the form then runs on mock data and saves nothing. */
  live: boolean;
}

/** Client boundary that connects the presentational form to the API. */
export function NewLeaveForm({ live, ...props }: NewLeaveFormProps) {
  async function onSubmit(values: LeaveRequestValues): Promise<SubmitOutcome> {
    const { request, warning } = await postLeaveRequest(values);
    return { status: request.status, warning: warning?.message ?? null };
  }

  return <LeaveRequestForm {...props} onSubmit={live ? onSubmit : undefined} />;
}
