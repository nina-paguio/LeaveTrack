import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
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
            <Button variant="secondary">Back to team requests</Button>
          </Link>
        }
      />
    );
  }

  const { request } = lookup;
  return (
    <>
      <PageHeader title="Request detail" />
      <Card className="flex flex-col gap-2 text-sm">
        <p>
          <span className="text-muted">Employee:</span> {request.employeeName}
        </p>
        <p>
          <span className="text-muted">Type:</span> {request.leaveTypeName}
        </p>
        <p>
          <span className="text-muted">Dates:</span> {request.startDate} to {request.endDate}
        </p>
        <p>
          <span className="text-muted">Reason:</span> {request.reason}
        </p>
        <StatusBadge status={request.status} />
      </Card>
    </>
  );
}
