"use client";

import { useRouter } from "next/navigation";
import { useTransition, type FormEvent, type ReactNode } from "react";
import { AuditResultsSkeleton } from "@/components/leave/audit-skeleton";
import { Button } from "@/components/ui/button";
import { DateField, Select } from "@/components/ui/controls";
import { FormField } from "@/components/ui/form-field";
import { ProgressBar } from "@/components/ui/progress-bar";
import { auditHref } from "@/lib/leave/audit-query";

export interface AuditFiltersProps {
  employees: { id: string; name: string }[];
  selectedId: string;
  from: string;
  to: string;
  /** The server-rendered report. Replaced by a skeleton while a new one loads. */
  children: ReactNode;
}

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/**
 * The filter form plus the report area. It is still a plain GET form (it works without JavaScript);
 * with JavaScript the submit becomes a client navigation so the page can show that it is working: the
 * button spins, a progress bar runs and the old report gives way to a skeleton until the new one
 * arrives. The report itself is always read on the server for one employee, never filtered here.
 */
export function AuditFilters({ employees, selectedId, from, to, children }: AuditFiltersProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const href = auditHref({
      userId: text(data.get("userId")),
      from: text(data.get("from")),
      to: text(data.get("to")),
    });
    startTransition(() => router.push(href));
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        method="get"
        action="/audit"
        onSubmit={onSubmit}
        aria-busy={pending}
        className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:items-end"
      >
        <div className="col-span-2 sm:col-span-1">
          <FormField id="audit-employee" label="Employee" required>
            <Select
              id="audit-employee"
              name="userId"
              defaultValue={selectedId}
              required
              disabled={pending}
            >
              <option value="">Choose an employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField id="audit-from" label="From">
          <DateField id="audit-from" name="from" defaultValue={from} disabled={pending} />
        </FormField>
        <FormField id="audit-to" label="To">
          <DateField id="audit-to" name="to" defaultValue={to} disabled={pending} />
        </FormField>
        <Button type="submit" loading={pending} className="col-span-2 sm:col-span-1">
          Run report
        </Button>
      </form>

      <div role="status" aria-live="polite" className="sr-only">
        {pending ? "Loading report…" : ""}
      </div>

      {pending ? (
        <>
          <ProgressBar label="Loading report" />
          <AuditResultsSkeleton />
        </>
      ) : (
        children
      )}
    </div>
  );
}
