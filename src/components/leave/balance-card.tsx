import { Card } from "@/components/ui/card";
import type { BalanceView } from "@/types/domain";

/** "2026-10-01" -> "October 2026" (UTC, so the label never shifts with the viewer's time zone). */
function monthLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function BalanceCard({ balance }: { balance: BalanceView }) {
  return (
    <Card aria-labelledby={`balance-${balance.leaveTypeId}`} role="group">
      <h2 id={`balance-${balance.leaveTypeId}`} className="text-sm font-medium text-muted">
        {balance.leaveTypeName}
      </h2>
      {balance.tracksBalance ? (
        <>
          <p className="mt-2 text-3xl font-semibold">
            {balance.confirmed}
            <span className="ml-1 text-base font-normal text-muted">days confirmed</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            Pending (not yet deducted):{" "}
            <span className="font-medium text-foreground">{balance.pending} days</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {balance.asOf
              ? `Accrued through ${monthLabel(balance.asOf)}`
              : "No accrual recorded yet"}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          No balance tracked. Unpaid leave is never blocked.
        </p>
      )}
    </Card>
  );
}
