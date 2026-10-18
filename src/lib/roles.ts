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
  { prefix: "/leave", roles: ["employee"] },
  { prefix: "/notifications", roles: ["employee", "manager"] },
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
  icon: "new" | "balance" | "team" | "audit" | "policies" | "notifications";
  /** Unread count shown on the nav item; set by the app shell, never in the static lists. */
  badge?: number;
}

/** Where each role lands after sign-in. The docs define no dashboard, so each role opens its main task. */
const HOME_BY_ROLE: Record<Role, string> = {
  employee: "/leave/balance",
  manager: "/team/requests",
  hr_admin: "/audit",
};

export function homeFor(role: Role): string {
  return HOME_BY_ROLE[role];
}

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  employee: [
    { href: "/leave/balance", label: "My leave", icon: "balance" },
    { href: "/leave/new", label: "New request", icon: "new" },
    { href: "/notifications", label: "Notifications", icon: "notifications" },
  ],
  manager: [
    { href: "/team/requests", label: "Approvals", icon: "team" },
    { href: "/notifications", label: "Notifications", icon: "notifications" },
  ],
  hr_admin: [
    { href: "/audit", label: "Audit", icon: "audit" },
    { href: "/admin/policies", label: "Policies", icon: "policies" },
  ],
};

export function navFor(role: Role): NavItem[] {
  return NAV_BY_ROLE[role];
}
