import type { Metadata } from "next";
import { BalanceCard } from "@/components/leave/balance-card";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/feedback";
import { loadMyLeave } from "@/lib/leave/mine-data";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "My balance" };

export default async function BalancePage() {
  const session = await getSession();
  if (!session) return null;
  const { live, balances } = await loadMyLeave(session);

  return (
    <>
      <PageHeader
        title="My balance"
        description="Confirmed balance is updated by the monthly accrual. Pending days are not yet deducted."
      />
      {live ? null : (
        <div className="mb-4">
          <Alert tone="warning">No database configured: showing mock data.</Alert>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {balances.map((b) => (
          <BalanceCard key={b.leaveTypeId} balance={b} />
        ))}
      </div>
    </>
  );
}
