"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/controls";
import { Alert } from "@/components/ui/feedback";
import { FormField } from "@/components/ui/form-field";

const INITIAL: LoginState = {};

export function LoginForm({ domain }: { domain?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL);
  const failed = Boolean(state.error);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <FormField id="email" label="Email" hint={domain ? `Use your @${domain} email.` : undefined}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          maxLength={254}
          required
          invalid={failed}
        />
      </FormField>
      <FormField id="password" label="Password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
          invalid={failed}
        />
      </FormField>
      <Button type="submit" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
