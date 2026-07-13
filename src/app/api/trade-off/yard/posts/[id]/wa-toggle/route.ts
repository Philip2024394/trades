// PATCH /api/trade-off/yard/posts/[id]/wa-toggle
//
// Flips the post's `whatsapp_replies_enabled` flag. Owner-only —
// verified via the trade session cookie OR the magic-link body
// `{slug, edit_token}`. Anti-spam feature: the OP toggles this off
// when their WhatsApp inbox is being drowned by a viral post.
//
// Body: { enabled: boolean }
// Response: { ok: true, whatsapp_replies_enabled: boolean }

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readTradeSession } from "@/lib/tradeSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { id: postId } = await ctx.params;
  if (!postId) {
    return NextResponse.json({ ok: false, error: "missing_post_id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const enabled = body.enabled === true;

  // Resolve the caller's listing — cookie or magic-link.
  let callerListingId: string | null = null;

  const providedSlug = s(body.slug).trim();
  const providedToken = s(body.edit_token).trim();
  if (providedSlug && providedToken) {
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, edit_token")
      .eq("slug", providedSlug)
      .maybeSingle();
    if (data && constantTimeEq(data.edit_token, providedToken)) {
      callerListingId = data.id;
    }
  }
  if (!callerListingId) {
    const session = readTradeSession(req);
    if (session?.listing_id) callerListingId = session.listing_id;
  }
  if (!callerListingId) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  // Owner check — the caller must be the post's original author.
  const { data: post } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id, listing_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post) {
    return NextResponse.json({ ok: false, error: "post_not_found" }, { status: 404 });
  }
  if (post.listing_id !== callerListingId) {
    return NextResponse.json({ ok: false, error: "not_post_author" }, { status: 403 });
  }

  const { error: updErr } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .update({ whatsapp_replies_enabled: enabled })
    .eq("id", postId);
  if (updErr) {
    // eslint-disable-next-line no-console
    console.error("[wa-toggle] update", updErr);
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, whatsapp_replies_enabled: enabled });
}
