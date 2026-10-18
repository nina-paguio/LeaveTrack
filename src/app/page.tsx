import { redirect } from "next/navigation";
import { homeFor } from "@/lib/roles";
import { getSession } from "@/lib/session";

// proxy.ts redirects "/" too; this keeps the route explicit and valid on its own.
export default async function Home() {
  const session = await getSession();
  redirect(session ? homeFor(session.role) : "/login");
}
