// GET /api/canteens/posts/[id]/replies
//
// Public read of replies for a canteen post. Anonymous — RLS lets
// live rows through, no auth required. Ordered oldest-first so the
// thread reads top-down like a comment section.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_LIMIT = 100;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
  }

  const res = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .select("id, author_slug, author_display_name, author_avatar_url, body, photo_urls, created_at, reactions")
    .eq("parent_id", id)
    .eq("status", "live")
    .order("created_at", { ascending: true })
    .limit(MAX_LIMIT);

  if (res.error) {
    return NextResponse.json({ ok: false, error: "db-read-failed", detail: res.error.message }, { status: 500 });
  }

  const replies = (res.data ?? []).map((r) => ({
    id: r.id,
    authorSlug: r.author_slug,
    authorDisplayName: r.author_display_name,
    authorAvatarUrl: r.author_avatar_url ?? null,
    body: r.body ?? "",
    photoUrls: (r.photo_urls ?? []) as string[],
    createdAt: r.created_at,
    likeCount: ((r.reactions ?? {}) as { like?: number }).like ?? 0
  }));

  return NextResponse.json({ ok: true, replies });
}
