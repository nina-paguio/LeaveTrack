import Link from "next/link";
import { EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-lg p-6">
      <EmptyState
        title="Page not found"
        description="The page you are looking for does not exist."
        action={
          <Link href="/">
            <Button>Back to home</Button>
          </Link>
        }
      />
    </main>
  );
}
