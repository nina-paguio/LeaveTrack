"use client";

import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <Alert tone="error">Something went wrong. Please try again.</Alert>
      <Button onClick={reset} className="self-start">
        Try again
      </Button>
    </main>
  );
}
