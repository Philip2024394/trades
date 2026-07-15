// /admin/image-submissions — moderation queue UI.
//
// Server-loads the current queue (pending + auto_approved) and hands
// off to the client shell for the swipe/keyboard nav flow. Every
// approve / reject round-trips through /api/admin/image-submissions/
// [id]/moderate — the shell does not write to Supabase directly so
// admin auth stays server-side.

import type { Metadata } from "next";
import { imageSubmissionsQueue } from "@/lib/imageSubmissions";
import { AdminImageSubmissionsShell } from "./AdminImageSubmissionsShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Image submissions | Admin",
  robots: { index: false, follow: false }
};

export default async function AdminImageSubmissionsPage() {
  const submissions = await imageSubmissionsQueue(120);
  return <AdminImageSubmissionsShell initialSubmissions={submissions}/>;
}
