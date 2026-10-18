import { redirect } from "next/navigation";

// "My requests" now lives on the same page as the balance (/leave/balance); keeps old links working.
export default function MyRequestsRedirect() {
  redirect("/leave/balance");
}
