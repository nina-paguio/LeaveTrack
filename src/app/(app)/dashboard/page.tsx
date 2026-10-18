import type { Metadata } from "next";
import Link from "next/link";
import { BalanceCard } from "@/components/leave/balance-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { loadMyLeave } from "@/lib/leave/mine-data";
import { loadTeam } from "@/lib/leave/team-data";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;
  const { role, user } = session;

  if (role === "hr_admin") {
    return (
      <>
        <PageHeader title="Dashboard" description="Audit records and leave policies." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <h2 className="font-semibold">Audit report</h2>
            <p className="mt-1 text-sm text-muted">
              Decision history for any employee or date range.
            </p>
            <Link href="/audit" className="mt-4 inline-block">
              <Button>Open audit report</Button>
            </Link>
          </Card>
          <Card>
            <h2 className="font-semibold">Leave policies</h2>
            <p className="mt-1 text-sm text-muted">Accrual rates per employee and leave type.</p>
            <Link href="/admin/policies" className="mt-4 inline-block">
              <Button variant="secondary">View policies</Button>
            </Link>
          </Card>
        </div>
      </>
    );
  }

  const { live, balances: allBalances } = await loadMyLeave(session);
  const balances = allBalances.filter((b) => b.tracksBalance);
  const pendingTeam =
    role === "manager"
      ? (await loadTeam(session)).rows.filter((r) => r.status === "pending").length
      : 0;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name}`}
        action={
          <Link href="/leave/new">
            <Button>New request</Button>
          </Link>
        }
      />
      {live ? null : (
        <div className="mb-4">
          <Alert tone="warning">No database configured: showing mock data.</Alert>
        </div>
      )}
      {role === "manager" ? (
        <Card className="mb-4">
          <h2 className="font-semibold">Team approvals</h2>
          <p className="mt-1 text-sm text-muted">
            {pendingTeam} pending {pendingTeam === 1 ? "request" : "requests"} from your direct
            reports.
          </p>
          <Link href="/team/requests" className="mt-4 inline-block">
            <Button variant="secondary">Review requests</Button>
          </Link>
        </Card>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {balances.map((b) => (
          <BalanceCard key={b.leaveTypeId} balance={b} />
        ))}
      </div>
    </>
  );
}
