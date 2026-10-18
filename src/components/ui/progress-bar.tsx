/**
 * Indeterminate progress: it shows that something is loading, not how far along it is. With reduced
 * motion the bar stays still (a partial fill) instead of sliding.
 */
export function ProgressBar({ label }: { label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-busy="true"
      className="h-1.5 w-full overflow-hidden rounded-full bg-primary-soft"
    >
      <div className="h-full w-2/5 animate-progress rounded-full bg-primary motion-reduce:animate-none" />
    </div>
  );
}
