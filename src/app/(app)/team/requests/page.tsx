import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { TeamQueue } from "@/components/leave/team-queue";
import { TeamQueueLive } from "@/components/leave/team-queue-live";
import { Alert } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { loadTeam } from "@/lib/leave/team-data";
import { paginate } from "@/lib/paginate";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Approvals" };

export default async function TeamRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { live, rows } = await loadTeam(session);

  // `rows` already holds only this manager's direct reports (scoped in SQL). Counts use the whole
  // list; the table shows one page of it.
  const pending = rows.filter((r) => r.status === "pending").length;
  const { items, page, pageCount } = paginate(rows, (await searchParams).page);

  return (
    <>
      <PageHeader
        title="Approvals"
        description={`${pending} pending · ${rows.length} ${
          rows.length === 1 ? "request" : "requests"
        } from your direct reports.`}
      />
      {live ? null : (
        <div className="mb-4">
          <Alert tone="warning">No database configured: showing mock data.</Alert>
        </div>
      )}
      {live ? <TeamQueueLive requests={items} /> : <TeamQueue requests={items} />}
      {rows.length > 0 ? (
        <Pagination page={page} pageCount={pageCount} hrefFor={(n) => `/team/requests?page=${n}`} />
      ) : null}
    </>
  );
}
