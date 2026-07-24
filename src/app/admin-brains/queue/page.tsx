// /admin-brains/queue?brain_slug=<slug> — Admin review queue.

import { redirect } from "next/navigation";
import { getBrainAdminFromCookie, nexBrainAdminEnabled } from "@/lib/nex/brains/_admin";
import { AdminQueue } from "@/apps/author-studio/components/admin/AdminQueue";

export default async function AdminQueuePage({ searchParams }: { searchParams: Promise<{ brain_slug?: string }> }) {
  if (!nexBrainAdminEnabled()) redirect("/admin-brains");
  const adminId = await getBrainAdminFromCookie();
  if (!adminId) redirect("/admin-brains");

  const { brain_slug } = await searchParams;
  return <AdminQueue brainSlug={brain_slug ?? "staircase"} adminId={adminId} />;
}
