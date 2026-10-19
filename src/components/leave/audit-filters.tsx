"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { IconLoader2 } from "@tabler/icons-react";
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

/**
 * The filter form plus the report area. It is still a plain GET form (it works without JavaScript);
 * with JavaScript the submit becomes a client navigation so the page can show that it is working: the
 * button shows a spinner, a progress bar runs and the old report gives way to a skeleton until the new
 * one arrives. The report itself is always read on the server for one employee, never filtered here.
 *
 * Two things keep it usable with a keyboard and honest about the URL:
 * - The inputs follow the URL (controlled, re-synced when the filters in the URL change), so after
 *   Back/Forward the form always shows what the table shows.
 * - Nothing the user is focused on is disabled while loading (that would drop focus to the page). The
 *   button uses aria-disabled and a second submit is ignored while one is running.
 */
export function AuditFilters({ employees, selectedId, from, to, children }: AuditFiltersProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ userId: selectedId, from, to });
  const [synced, setSynced] = useState({ selectedId, from, to });

  // Re-sync the inputs when the URL's filters change (Back/Forward). Done during render, the
  // documented alternative to an effect, so there is no flash of stale values.
  if (synced.selectedId !== selectedId || synced.from !== from || synced.to !== to) {
    setSynced({ selectedId, from, to });
    setValues({ userId: selectedId, from, to });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    startTransition(() => router.push(auditHref(values)));
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
              value={values.userId}
              onChange={(e) => setValues((v) => ({ ...v, userId: e.target.value }))}
              required
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
          <DateField
            id="audit-from"
            name="from"
            value={values.from}
            onChange={(e) => setValues((v) => ({ ...v, from: e.target.value }))}
          />
        </FormField>
        <FormField id="audit-to" label="To">
          <DateField
            id="audit-to"
            name="to"
            value={values.to}
            onChange={(e) => setValues((v) => ({ ...v, to: e.target.value }))}
          />
        </FormField>
        <Button
          type="submit"
          aria-disabled={pending}
          className="col-span-2 aria-disabled:cursor-wait aria-disabled:opacity-70 sm:col-span-1"
        >
          {pending ? (
            <IconLoader2
              size={16}
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : null}
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
