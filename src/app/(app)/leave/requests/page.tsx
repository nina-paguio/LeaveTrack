import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { RequestList } from "@/components/leave/request-list";
import { Alert } from "@/components/ui/feedback";
import { loadMyLeave } from "@/lib/leave/mine-data";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "My requests" };

export default async function MyRequestsPage() {
  const session = await getSession();
  if (!session) return null;
  const { live, requests, balances } = await loadMyLeave(session);

  return (
    <>
      <PageHeader title="My requests" />
      {live ? null : (
        <div className="mb-4">
          <Alert tone="warning">No database configured: showing mock data.</Alert>
        </div>
      )}
      <RequestList
        requests={requests}
        leaveTypeName={(id) =>
          balances.find((b) => b.leaveTypeId === id)?.leaveTypeName ?? "Unknown"
        }
      />
    </>
  );
}
