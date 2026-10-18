"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { isRole } from "@/lib/roles";

/**
 * MOCK SIGN-IN (ADR-LeaveTrack-E001). Accepts any input and trusts the submitted role.
 * Must never ship past the scaffold stage: Day 1 replaces how this cookie is set, not the guard.
 */
export async function loginAction(formData: FormData): Promise<void> {
  const submitted = formData.get("role");
  const role = isRole(submitted) ? submitted : "employee";

  const store = await cookies();
  store.set(env.SESSION_COOKIE_NAME, role, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: env.SESSION_MAX_AGE_SECONDS,
  });

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(env.SESSION_COOKIE_NAME);
  redirect("/login");
}
