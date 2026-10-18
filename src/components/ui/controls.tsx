import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { controlClass } from "@/components/ui/form-field";

type Invalid = { invalid?: boolean };

export function Input({
  invalid,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & Invalid) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(controlClass(invalid), className)}
      {...rest}
    />
  );
}

/** Native date input: reliable on mobile browsers (BR-05). Value format is YYYY-MM-DD. */
export function DateField(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & Invalid) {
  return <Input type="date" {...props} />;
}

export function Select({
  invalid,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & Invalid) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(controlClass(invalid), className)}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea({
  invalid,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & Invalid) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(controlClass(invalid), "min-h-24 py-2", className)}
      {...rest}
    />
  );
}
