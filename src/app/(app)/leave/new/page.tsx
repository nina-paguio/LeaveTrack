import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { NewLeaveForm } from "@/components/leave/new-leave-form";
import { Alert } from "@/components/ui/feedback";
import { loadSubmitFormData } from "@/lib/leave/repo";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { balancesFor, leaveTypes as mockLeaveTypes } from "@/mocks/data";

export const metadata: Metadata = { title: "New leave request" };

export default async function NewLeavePage() {
  const session = await getSession();
  if (!session) return null;

  // The API validates real database UUIDs, so leave types and balances come from the database.
  // With no Supabase credentials the page keeps working on mock data and saves nothing.
  const live = isSupabaseConfigured();
  const { leaveTypes, balances } = live
    ? await loadSubmitFormData(session.user.email)
    : { leaveTypes: mockLeaveTypes, balances: balancesFor(session.user.id) };

  return (
    <>
      <PageHeader
        title="New leave request"
        description="Your manager is notified when you submit."
      />
      {live || process.env.NODE_ENV === "production" ? null : (
        <div className="mb-4 max-w-xl">
          <Alert tone="warning">
            No database configured: this form runs on mock data and nothing is saved.
          </Alert>
        </div>
      )}
      <NewLeaveForm live={live} leaveTypes={leaveTypes} balances={balances} />
    </>
  );
}
