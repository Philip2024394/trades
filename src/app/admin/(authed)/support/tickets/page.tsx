// /admin/support/tickets — support ticket queue.

import type { Metadata } from "next";
import { ticketQueue } from "@/lib/supportTickets";
import { AdminSupportShell } from "./AdminSupportShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Support tickets | Admin", robots: { index: false, follow: false } };

export default async function AdminSupportTicketsPage() {
  const tickets = await ticketQueue(100);
  return <AdminSupportShell initialTickets={tickets}/>;
}
