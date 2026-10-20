import type { ButtonHTMLAttributes } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "border border-border bg-surface text-foreground hover:bg-primary-soft",
  danger: "bg-error text-white hover:bg-error/90",
  ghost: "text-foreground hover:bg-primary-soft",
};

/** The look of a button, for a link that must look like one (a plain <a>, not a <button>). */
export function buttonClass(variant: ButtonVariant = "primary", className?: string): string {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors",
    VARIANTS[variant],
    className,
  );
}

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(
        variant,
        cn("disabled:cursor-not-allowed disabled:opacity-50", className),
      )}
      {...rest}
    >
      {loading ? <IconLoader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
