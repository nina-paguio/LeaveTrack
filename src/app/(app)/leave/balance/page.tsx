import type { Metadata } from "next";
import { BalanceCard } from "@/components/leave/balance-card";
import { PageHeader } from "@/components/layout/page-header";
import { RequestList } from "@/components/leave/request-list";
import { Alert } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { loadMyLeave } from "@/lib/leave/mine-data";
import { formatMonth } from "@/lib/leave/format";
import { paginate } from "@/lib/paginate";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "My leave" };

export default async function MyLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { live, balances, requests } = await loadMyLeave(session);

  // Pending first (they are the ones still moving), then the rest in the order the service returned.
  const ordered = [...requests].sort(
    (a, b) => Number(b.status === "pending") - Number(a.status === "pending"),
  );
  const { items, page, pageCount } = paginate(ordered, (await searchParams).page);
  const lastAccrual = balances
    .map((b) => b.asOf)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  return (
    <>
      <PageHeader
        title="My leave"
        description={
          lastAccrual
            ? `Balances update with the monthly accrual. Last accrual: ${formatMonth(lastAccrual)}.`
            : "Balances update with the monthly accrual. No accrual has run yet."
        }
      />
      {live ? null : (
        <div className="mb-4">
          <Alert tone="warning">No database configured: showing mock data.</Alert>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {balances.map((b) => (
          <BalanceCard key={b.leaveTypeId} balance={b} />
        ))}
      </div>
      <section aria-labelledby="my-requests" className="mt-6 sm:mt-8">
        <h2 id="my-requests" className="mb-3 text-base font-semibold sm:text-lg">
          My requests
        </h2>
        <RequestList
          requests={items}
          leaveTypeName={(id) =>
            balances.find((b) => b.leaveTypeId === id)?.leaveTypeName ?? "Unknown"
          }
        />
        {requests.length > 0 ? (
          <Pagination
            page={page}
            pageCount={pageCount}
            hrefFor={(n) => `/leave/balance?page=${n}`}
          />
        ) : null}
      </section>
    </>
  );
}
