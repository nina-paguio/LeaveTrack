import { redirect } from "next/navigation";

// proxy.ts redirects "/" too; this keeps the route explicit and valid on its own.
export default function Home() {
  redirect("/dashboard");
}
