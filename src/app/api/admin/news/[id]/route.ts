// PATCH /api/admin/news/[id]
// DELETE /api/admin/news/[id]
//
// Admin-gated. PATCH updates the row in place. DELETE hard-removes.
// (Yard cross-post + hide removed 2026-07-27 with the yard purge.)

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  VALID_CATEGORY_SLUGS,
  VALID_STATUSES
} from "@/lib/newsCategories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  title?: string;
  slug?: string;
  category?: string;
  excerpt?: string | null;
  body_markdown?: string;
  banner_url?: string | null;
  video_url?: string | null;
  status?: string;
};

type Params = Promise<{ id: string }>;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Params }
): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Read the current row so we can detect status transitions.
  const current = await supabaseAdmin
    .from("hammerex_xrated_news_posts")
    .select("id, slug, title, excerpt, status, published_at")
    .eq("id", id)
    .maybeSingle();

  if (!current.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim();
  }
  if (typeof body.slug === "string" && body.slug.trim()) {
    const s = body.slug.trim();
    if (!/^[a-z0-9-]+$/.test(s)) {
      return NextResponse.json(
        { error: "Slug must be lowercase alphanumerics + hyphens" },
        { status: 400 }
      );
    }
    patch.slug = s;
  }
  if (typeof body.category === "string") {
    if (!VALID_CATEGORY_SLUGS.includes(body.category as never)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    patch.category = body.category;
  }
  if (body.excerpt !== undefined) {
    patch.excerpt = body.excerpt;
  }
  if (typeof body.body_markdown === "string") {
    patch.body_markdown = body.body_markdown;
  }
  if (body.banner_url !== undefined) {
    patch.banner_url = body.banner_url;
  }
  if (body.video_url !== undefined) {
    patch.video_url = body.video_url;
  }

  let newStatus: string | undefined;
  if (typeof body.status === "string") {
    if (!VALID_STATUSES.includes(body.status as never)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    newStatus = body.status;
    patch.status = body.status;
    // First publish — stamp published_at if it's still null.
    if (
      body.status === "live" &&
      !current.data.published_at
    ) {
      patch.published_at = new Date().toISOString();
    }
  }

  const upd = await supabaseAdmin
    .from("hammerex_xrated_news_posts")
    .update(patch)
    .eq("id", id)
    .select("id, slug, title, excerpt, status")
    .single();

  if (upd.error || !upd.data) {
    if (upd.error?.code === "23505") {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 409 }
      );
    }
    console.error("[api/admin/news/:id] update failed:", upd.error);
    return NextResponse.json(
      { error: upd.error?.message ?? "Update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: upd.data.id });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Params }
): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const del = await supabaseAdmin
    .from("hammerex_xrated_news_posts")
    .delete()
    .eq("id", id);
  if (del.error) {
    console.error("[api/admin/news/:id] delete failed:", del.error);
    return NextResponse.json(
      { error: del.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
