import type { Role } from "@/types/domain";

export const ROLES: readonly Role[] = ["employee", "manager", "hr_admin"] as const;

export const ROLE_LABELS: Record<Role, string> = {
  employee: "Employee",
  manager: "Manager",
  hr_admin: "HR Admin",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Roles allowed per route prefix. Any authenticated role may open prefixes not listed here. */
const ROUTE_ROLES: ReadonlyArray<{ prefix: string; roles: readonly Role[] }> = [
  { prefix: "/leave", roles: ["employee", "manager"] },
  { prefix: "/team", roles: ["manager"] },
  { prefix: "/audit", roles: ["hr_admin"] },
  { prefix: "/api/audit", roles: ["hr_admin"] },
  { prefix: "/admin", roles: ["hr_admin"] },
];

export function canAccess(pathname: string, role: Role): boolean {
  const rule = ROUTE_ROLES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return rule ? rule.roles.includes(role) : true;
}

export interface NavItem {
  href: string;
  label: string;
  icon: "dashboard" | "new" | "balance" | "requests" | "team" | "audit" | "policies";
}

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  employee: [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/leave/new", label: "New request", icon: "new" },
    { href: "/leave/balance", label: "Balance", icon: "balance" },
    { href: "/leave/requests", label: "My requests", icon: "requests" },
  ],
  manager: [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/leave/new", label: "New request", icon: "new" },
    { href: "/leave/balance", label: "Balance", icon: "balance" },
    { href: "/leave/requests", label: "My requests", icon: "requests" },
    { href: "/team/requests", label: "Team", icon: "team" },
  ],
  hr_admin: [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/audit", label: "Audit", icon: "audit" },
    { href: "/admin/policies", label: "Policies", icon: "policies" },
  ],
};

export function navFor(role: Role): NavItem[] {
  return NAV_BY_ROLE[role];
}
