// /admin/news/new — composer for a brand-new newsroom post.
//
// Server component (gated by adminAuth) that just renders the shared
// NewsComposer client island. The POST hits /api/admin/news, which
// returns 200 + the new row's id (and idempotently cross-posts to
// Yard when status='live').

import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdminAuthed } from "@/lib/adminAuth";
import { NewsComposer } from "../NewsComposer";

export const dynamic = "force-dynamic";

export default async function AdminNewsNewPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login");
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href="/admin/news"
        className="text-[12px] text-brand-muted hover:text-brand-text"
      >
        ← Back to Newsroom admin
      </Link>
      <h1 className="mt-2 text-lg font-semibold">New newsroom post</h1>
      <p className="text-xs text-brand-muted">
        Draft saves silently. Setting Status → live publishes to /news and
        cross-posts to The Yard.
      </p>
      <NewsComposer mode="new" />
    </div>
  );
}
