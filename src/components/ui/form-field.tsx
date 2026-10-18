import type { ReactNode } from "react";
import { IconAlertCircle } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

export interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

/** Wrap a control; give the control `aria-describedby={describedBy(id, {hint, error})}`. */
export function describedBy(
  id: string,
  parts: { hint?: string; error?: string },
): string | undefined {
  const ids = [parts.hint ? `${id}-hint` : null, parts.error ? `${id}-error` : null].filter(
    Boolean,
  );
  return ids.length ? ids.join(" ") : undefined;
}

export function FormField({ id, label, hint, error, required, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-error">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1 text-sm text-error">
          <IconAlertCircle size={16} aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const controlClass = (invalid?: boolean) =>
  cn(
    "min-h-11 w-full rounded-md border bg-surface px-3 text-base sm:text-sm pointer-coarse:text-base",
    "disabled:cursor-not-allowed disabled:bg-background disabled:opacity-60",
    invalid ? "border-error" : "border-border",
  );
