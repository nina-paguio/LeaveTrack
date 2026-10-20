import type { Metadata } from "next";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { REFUSED_MESSAGE, UNAVAILABLE_MESSAGE } from "@/lib/auth/messages";
import { env } from "@/lib/env";
import { isGoogleSignInEnabled } from "@/lib/supabase/oauth";

export const metadata: Metadata = { title: "Sign in" };

// Only these two fixed messages can ever be shown: the query value picks one, it is never printed.
const ERROR_MESSAGES = new Map([
  ["google", REFUSED_MESSAGE],
  ["unavailable", UNAVAILABLE_MESSAGE],
]);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERROR_MESSAGES.get(error) : undefined;

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-4">
      <h1 className="text-2xl font-semibold tracking-tight text-primary">LeaveTrack</h1>
      <Card>
        <div className="flex flex-col gap-4">
          {message ? <Alert tone="error">{message}</Alert> : null}
          <LoginForm domain={env.ALLOWED_EMAIL_DOMAIN} />
          {isGoogleSignInEnabled() ? <GoogleSignInButton /> : null}
        </div>
      </Card>
    </main>
  );
}
