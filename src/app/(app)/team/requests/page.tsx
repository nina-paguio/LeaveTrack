import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { TeamQueue } from "@/components/leave/team-queue";
import { TeamQueueLive } from "@/components/leave/team-queue-live";
import { Alert } from "@/components/ui/feedback";
import { loadTeam } from "@/lib/leave/team-data";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Team requests" };

export default async function TeamRequestsPage() {
  const session = await getSession();
  if (!session) return null;
  const { live, rows } = await loadTeam(session);

  return (
    <>
      <PageHeader title="Team requests" description="Requests from your direct reports only." />
      {live ? null : (
        <div className="mb-4">
          <Alert tone="warning">No database configured: showing mock data.</Alert>
        </div>
      )}
      {live ? <TeamQueueLive requests={rows} /> : <TeamQueue requests={rows} />}
    </>
  );
}
