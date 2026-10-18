export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+$/;

/** A well-formed address of a sane length. Says nothing about whether it exists. */
export function isPlausibleEmail(email: string): boolean {
  return email.length <= 254 && SIMPLE_EMAIL.test(email);
}

/** True only for a well-formed address whose domain is exactly `domain` (no subdomains, no lookalikes). */
export function isCompanyEmail(email: string, domain: string | undefined): boolean {
  if (!domain || !isPlausibleEmail(email)) return false;
  const at = email.lastIndexOf("@");
  return email.slice(at + 1) === domain.trim().toLowerCase().replace(/^@/, "");
}
