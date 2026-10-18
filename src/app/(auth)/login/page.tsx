import type { Metadata } from "next";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/controls";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { FormField } from "@/components/ui/form-field";
import { loginAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="text-2xl font-semibold text-primary">LeaveTrack</h1>
      <Alert tone="warning">
        Mock sign-in (Day 0). Any input is accepted and no credentials are checked. This must never
        ship to production.
      </Alert>
      <Card>
        <form action={loginAction} className="flex flex-col gap-4">
          <FormField id="email" label="Email">
            <Input id="email" name="email" type="email" autoComplete="email" />
          </FormField>
          <FormField id="password" label="Password">
            <Input id="password" name="password" type="password" autoComplete="current-password" />
          </FormField>
          <RoleSwitcher />
          <Button type="submit">Sign in</Button>
        </form>
      </Card>
    </main>
  );
}
