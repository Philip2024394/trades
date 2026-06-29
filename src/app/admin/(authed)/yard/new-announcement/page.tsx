// /admin/yard/new-announcement — admin composer for Trade Off team
// announcements. Single form (title + body). Pinned by default so the
// announcement floats to the top of the public feed. POSTs to
// /api/admin/yard/announcement and redirects to the Announcements tab
// on success.
//
// Server component shell with a client form island.
import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdminAuthed } from "@/lib/adminAuth";
import { NewAnnouncementForm } from "./NewAnnouncementForm";

export const dynamic = "force-dynamic";

export default async function NewAnnouncementPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">New xratedtrade.com announcement</h1>
        <Link
          href="/admin/yard?tab=announcements"
          className="rounded border border-brand-line px-3 py-1.5 text-[11px] text-brand-muted hover:bg-brand-line hover:text-brand-text"
        >
          ← Back
        </Link>
      </div>
      <p className="mb-4 text-xs text-brand-muted">
        Announcements are pinned to the top of the Yard feed and rendered
        with the yellow rim + xratedtrade.com Team brand. Markdown is allowed
        in the body — keep it short and direct.
      </p>
      <NewAnnouncementForm />
    </div>
  );
}
