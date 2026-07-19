// POST /api/homeowner/posts/[id]/replies — homeowner replies to their own post

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { addReply } from "@/lib/homeowners/posts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  // Verify the post belongs to the homeowner
  const post = await supabaseAdmin
    .from("hammerex_sitebook_posts")
    .select("id, homeowner_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post.data || (post.data as { homeowner_id: string }).homeowner_id !== homeowner.id) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { body?: string } | null;
  if (!body?.body?.trim()) return NextResponse.json({ ok: false, error: "empty-body" }, { status: 400 });

  const res = await addReply({
    postId,
    authorType:  "homeowner",
    authorId:    homeowner.id,
    authorName:  homeowner.first_name || "Homeowner",
    body:        body.body
  });

  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true, replyId: res.reply.id });
}
