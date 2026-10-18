"use client";

import { useRouter } from "next/navigation";
import { TeamQueue, type TeamQueueProps } from "@/components/leave/team-queue";
import { useToast } from "@/components/ui/toast";
import { postDecision } from "@/lib/api/decide-leave-request";

/** Client boundary that connects the presentational queue to the decision API. */
export function TeamQueueLive({ requests }: Pick<TeamQueueProps, "requests">) {
  const router = useRouter();
  const toast = useToast();

  async function onDecision(id: string, decision: "approved" | "rejected", reason?: string) {
    try {
      await postDecision(id, decision === "approved" ? "approve" : "reject", reason);
      toast.show(decision === "approved" ? "Request approved." : "Request rejected.", "success");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Could not record the decision.", "error");
    } finally {
      // Re-read the queue: a decided request must update, and a stale one (already decided) must too.
      router.refresh();
    }
  }

  return <TeamQueue requests={requests} onDecision={onDecision} />;
}
