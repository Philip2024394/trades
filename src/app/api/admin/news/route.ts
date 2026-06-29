// POST /api/admin/news
//
// Admin-gated. Creates a newsroom post. When status='live' on create,
// the route ALSO calls createYardCrossPost so The Yard gets the
// announcement instantly. Idempotent on yard side via the metadata
// JSON lookup.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  VALID_CATEGORY_SLUGS,
  VALID_STATUSES,
  slugifyTitle
} from "@/lib/newsCategories";
import { createYardCrossPost } from "@/lib/newsCrossPost";

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const slug = (body.slug ?? "").trim() || slugifyTitle(title);
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "Slug must be lowercase alphanumerics + hyphens" },
      { status: 400 }
    );
  }

  const category = (body.category ?? "general").trim();
  if (!VALID_CATEGORY_SLUGS.includes(category as never)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const status = (body.status ?? "draft").trim();
  if (!VALID_STATUSES.includes(status as never)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const published_at = status === "live" ? now : null;

  const insert = {
    slug,
    title,
    category,
    excerpt: body.excerpt ?? null,
    body_markdown: body.body_markdown ?? "",
    banner_url: body.banner_url ?? null,
    video_url: body.video_url ?? null,
    status,
    published_at,
    updated_at: now
  };

  const ins = await supabaseAdmin
    .from("hammerex_xrated_news_posts")
    .insert(insert)
    .select("id, slug, title, excerpt, status")
    .single();

  if (ins.error || !ins.data) {
    if (ins.error?.code === "23505") {
      return NextResponse.json(
        { error: `Slug "${slug}" already exists` },
        { status: 409 }
      );
    }
    console.error("[api/admin/news] insert failed:", ins.error);
    return NextResponse.json(
      { error: ins.error?.message ?? "Insert failed" },
      { status: 500 }
    );
  }

  // Cross-post to Yard if going live straight away.
  if (status === "live") {
    try {
      await createYardCrossPost({
        id: ins.data.id,
        slug: ins.data.slug,
        title: ins.data.title,
        excerpt: ins.data.excerpt
      });
    } catch (err) {
      console.error("[api/admin/news] yard cross-post threw:", err);
    }
  }

  return NextResponse.json({ ok: true, id: ins.data.id, slug: ins.data.slug });
}
