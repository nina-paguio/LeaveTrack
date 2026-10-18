"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { DateField, Select, Textarea } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog";
import { describedBy, FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { inclusiveDays } from "@/lib/leave/days";
import type { BalanceView, LeaveType, RequestStatus } from "@/types/domain";

export interface LeaveRequestValues {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

/** What the form shows after a successful submit. `warning` is the server's over-balance message. */
export interface SubmitOutcome {
  status: RequestStatus;
  warning?: string | null;
}

export interface LeaveRequestFormProps {
  leaveTypes: LeaveType[];
  balances: Pick<BalanceView, "leaveTypeId" | "confirmed">[];
  /** Wired to POST /api/leave-requests by the page. Without it the form only shows a mock toast. */
  onSubmit?: (values: LeaveRequestValues) => Promise<SubmitOutcome | void> | SubmitOutcome | void;
}

export function LeaveRequestForm({ leaveTypes, balances, onSubmit }: LeaveRequestFormProps) {
  const toast = useToast();
  const [values, setValues] = useState<LeaveRequestValues>({
    leaveTypeId: leaveTypes[0]?.id ?? "",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const set = <K extends keyof LeaveRequestValues>(key: K, value: LeaveRequestValues[K]) =>
    setValues((cur) => ({ ...cur, [key]: value }));

  const dateError =
    values.startDate && values.endDate && values.endDate < values.startDate
      ? "End date cannot be before the start date."
      : undefined;
  const missing = (v: string) => (attempted && !v ? "This field is required." : undefined);

  const type = leaveTypes.find((t) => t.id === values.leaveTypeId);
  const balance = balances.find((b) => b.leaveTypeId === values.leaveTypeId);
  const requested =
    values.startDate && values.endDate && !dateError
      ? inclusiveDays(values.startDate, values.endDate)
      : 0;
  const overBalance = Boolean(type?.tracksBalance && balance && requested > balance.confirmed);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    if (!values.leaveTypeId || !values.startDate || !values.endDate || !values.reason || dateError)
      return;
    // AC3: over-balance is a warning, not a block, but the employee confirms before it is sent.
    if (overBalance) {
      setConfirmOpen(true);
      return;
    }
    void send();
  }

  async function send() {
    setSubmitting(true);
    setOutcome(null);
    try {
      if (onSubmit) {
        const result = await onSubmit(values);
        if (result) {
          setOutcome(result);
          setValues((cur) => ({ ...cur, startDate: "", endDate: "", reason: "" }));
          setAttempted(false);
        }
      } else {
        toast.show("Mock only: nothing was saved (no database configured).", "info");
      }
    } catch (err) {
      toast.show(
        err instanceof Error ? err.message : "Could not submit the request. Please try again.",
        "error",
      );
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="flex max-w-xl flex-col gap-4">
        {outcome ? (
          <Alert tone="info">
            Request submitted and {outcome.status}. Your manager will review it.
            {outcome.warning ? ` ${outcome.warning}` : ""}
          </Alert>
        ) : null}

        <FormField id="leaveType" label="Leave type" required>
          <Select
            id="leaveType"
            value={values.leaveTypeId}
            onChange={(e) => set("leaveTypeId", e.target.value)}
          >
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="startDate" label="Start date" required error={missing(values.startDate)}>
            <DateField
              id="startDate"
              value={values.startDate}
              invalid={Boolean(missing(values.startDate))}
              aria-describedby={describedBy("startDate", { error: missing(values.startDate) })}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </FormField>
          <FormField
            id="endDate"
            label="End date"
            required
            error={dateError ?? missing(values.endDate)}
          >
            <DateField
              id="endDate"
              value={values.endDate}
              invalid={Boolean(dateError ?? missing(values.endDate))}
              aria-describedby={describedBy("endDate", {
                error: dateError ?? missing(values.endDate),
              })}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </FormField>
        </div>

        {overBalance ? (
          <Alert tone="warning">
            This request is {requested} days but your remaining {type?.name} balance is{" "}
            {balance?.confirmed} days. You may still submit for HR override.
          </Alert>
        ) : null}

        <FormField id="reason" label="Reason" required error={missing(values.reason)}>
          <Textarea
            id="reason"
            value={values.reason}
            invalid={Boolean(missing(values.reason))}
            aria-describedby={describedBy("reason", { error: missing(values.reason) })}
            onChange={(e) => set("reason", e.target.value)}
          />
        </FormField>

        <Button type="submit" loading={submitting} className="sm:self-start">
          Submit request
        </Button>
      </form>
      <Dialog
        open={confirmOpen}
        title="Submit over your balance?"
        onClose={() => setConfirmOpen(false)}
      >
        <p className="text-sm">
          This request is {requested} days but your remaining {type?.name} balance is{" "}
          {balance?.confirmed} days. It can still be submitted for HR override.
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={submitting} onClick={() => setConfirmOpen(false)}>
            Go back
          </Button>
          <Button loading={submitting} onClick={() => void send()}>
            Submit anyway
          </Button>
        </div>
      </Dialog>
    </>
  );
}
