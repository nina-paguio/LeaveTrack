"use server";

import { revalidatePath } from "next/cache";
import { markAllRead } from "@/lib/leave/notifications-data";
import { logger } from "@/lib/logger";
import { getSession } from "@/lib/session";

/** Marks the signed-in user's own notifications read. The user comes from the session, never the form. */
export async function markAllReadAction(): Promise<void> {
  const session = await getSession();
  if (!session || session.role === "hr_admin") return;
  try {
    await markAllRead(session);
  } catch (err) {
    logger.error("mark notifications read failed", { err: String(err) });
    return;
  }
  // The badge lives in the layout, so refresh the whole app shell.
  revalidatePath("/", "layout");
}
