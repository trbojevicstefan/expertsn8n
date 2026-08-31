import { redirect } from "next/navigation";

/** Disputes and general support share one queue now: a dispute is a ticket with
 *  a contract attached. */
export default function Disputes() {
  redirect("/admin/tickets");
}
