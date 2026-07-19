// POST /api/canteens/posts/[id]/edit   { body }
//
// Update the body of a canteen post. Stamps `body_edited_at` so the
// UI renders an "(edited)" label. Only the post author can edit.
// Cookie-session auth via getMerchantSlug.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 5000;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const callerSlug = await getMerchantSlug();
  if (!callerSlug) return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });

  let payload: { body?: unknown };
  try { payload = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!body) return NextResponse.json({ ok: false, error: "empty-body" }, { status: 400 });
  if (body.length > MAX_BODY) {
    return NextResponse.json({ ok: false, error: "body-too-long", detail: `${MAX_BODY} char max` }, { status: 400 });
  }

  const post = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .select("id, author_slug")
    .eq("id", id)
    .maybeSingle();
  if (!post.data) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

  if (post.data.author_slug !== callerSlug) {
    return NextResponse.json({ ok: false, error: "not-author" }, { status: 403 });
  }

  const res = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .update({ body, body_edited_at: new Date().toISOString() })
    .eq("id", id);
  if (res.error) return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
