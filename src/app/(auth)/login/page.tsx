import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-4">
      <h1 className="text-2xl font-semibold tracking-tight text-primary">LeaveTrack</h1>
      <Card>
        <LoginForm domain={env.ALLOWED_EMAIL_DOMAIN} />
      </Card>
    </main>
  );
}
