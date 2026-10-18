import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateRange } from "@/lib/leave/format";
import { loadTeamRequest } from "@/lib/leave/team-data";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Request detail" };

export default async function TeamRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;

  const { lookup } = await loadTeamRequest(session, id);

  if (lookup.kind === "missing") notFound();

  // US-03 AC3: a request outside the manager's team is forbidden, never rendered.
  if (lookup.kind === "forbidden") {
    return (
      <EmptyState
        variant="forbidden"
        title="You do not have access to this request"
        description="Only requests from your direct reports can be viewed."
        action={
          <Link href="/team/requests">
            <Button variant="secondary">Back to approvals</Button>
          </Link>
        }
      />
    );
  }

  const { request } = lookup;
  return (
    <>
      <PageHeader title="Request detail" />
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold [overflow-wrap:anywhere]">{request.employeeName}</h2>
            <p className="mt-0.5 text-sm text-muted">
              {request.leaveTypeName} · {formatDateRange(request.startDate, request.endDate)}
            </p>
          </div>
          <StatusBadge status={request.status} />
        </div>
        <dl className="mt-4 text-sm">
          <dt className="text-muted">Reason</dt>
          <dd className="mt-0.5 [overflow-wrap:anywhere]">{request.reason}</dd>
        </dl>
      </Card>
    </>
  );
}
