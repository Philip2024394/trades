// /admin/news/[id]/edit — edit a single newsroom post.
//
// Loads the row by id, hands the data to NewsComposer pre-filled.
// PATCH lands at /api/admin/news/[id]. If status flips draft→live,
// the API idempotently creates the Yard cross-post.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NewsComposer } from "../../NewsComposer";
import type { NewsStatus } from "@/lib/newsCategories";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function AdminNewsEditPage({
  params
}: {
  params: Params;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login");
  }
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("hammerex_xrated_news_posts")
    .select(
      "id, slug, title, category, excerpt, body_markdown, banner_url, video_url, status"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href="/admin/news"
        className="text-[12px] text-brand-muted hover:text-brand-text"
      >
        ← Back to Newsroom admin
      </Link>
      <h1 className="mt-2 text-lg font-semibold">Edit post</h1>
      <p className="text-xs text-brand-muted">
        Editing {data.title}. /news/{data.slug}
      </p>
      <NewsComposer
        mode="edit"
        initial={{
          id: data.id,
          title: data.title,
          slug: data.slug,
          category: data.category,
          excerpt: data.excerpt ?? "",
          body_markdown: data.body_markdown ?? "",
          banner_url: data.banner_url ?? "",
          video_url: data.video_url ?? "",
          status: data.status as NewsStatus
        }}
      />
    </div>
  );
}
