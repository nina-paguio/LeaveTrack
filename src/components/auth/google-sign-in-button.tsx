import { IconBrandGoogle } from "@tabler/icons-react";
import { buttonClass } from "@/components/ui/button";

/**
 * A plain link, not a next/link: it must be a full navigation to the server route that starts the
 * sign-in, and a prefetch must never trigger it.
 */
export function GoogleSignInButton() {
  return (
    <>
      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <a href="/api/auth/google" className={buttonClass("secondary")}>
        <IconBrandGoogle size={20} aria-hidden="true" />
        Sign in with Google
      </a>
    </>
  );
}
