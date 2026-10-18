import { Card } from "@/components/ui/card";
import type { BalanceView } from "@/types/domain";

export function BalanceCard({ balance }: { balance: BalanceView }) {
  return (
    <Card aria-labelledby={`balance-${balance.leaveTypeId}`} role="group" className="p-4 sm:p-5">
      <h2 id={`balance-${balance.leaveTypeId}`} className="text-sm font-medium text-muted">
        {balance.leaveTypeName}
      </h2>
      {balance.tracksBalance ? (
        <>
          <p className="mt-1 text-2xl font-semibold">
            {balance.confirmed}
            <span className="ml-1.5 text-sm font-normal text-muted">days confirmed</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            Pending, not yet deducted:{" "}
            <span className="whitespace-nowrap font-medium text-foreground">
              {balance.pending} days
            </span>
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted">No balance tracked. Never blocked.</p>
      )}
    </Card>
  );
}
