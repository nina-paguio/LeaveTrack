import { ROLE_LABELS, ROLES } from "@/lib/roles";

/** Mock sign-in only: picks which role the mock cookie holds. Removed when real auth lands (Day 1). */
export function RoleSwitcher({
  name = "role",
  defaultValue = "employee",
}: {
  name?: string;
  defaultValue?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Sign in as</legend>
      {ROLES.map((role) => (
        <label
          key={role}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
        >
          <input type="radio" name={name} value={role} defaultChecked={role === defaultValue} />
          {ROLE_LABELS[role]}
        </label>
      ))}
    </fieldset>
  );
}
