// Per-comment reactions (like / dislike).
//
// POST   /api/trade-off/yard/comments/[id]/reactions  { slug, token, kind }
//         Idempotent — upserts on (comment_id, reactor_listing_id).
// DELETE /api/trade-off/yard/comments/[id]/reactions  { slug, token }
//         Removes the reactor's reaction, if any.

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_KINDS = new Set(["like", "dislike"]);

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

async function authListing(
  slug: string,
  token: string
): Promise<{ id: string } | null> {
  if (!slug || !token) return null;
  const { data: listing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing || listing.status !== "live") return null;
  if (!constantTimeEq(listing.edit_token, token)) return null;
  return { id: listing.id };
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { id: commentId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const slug = s(body.slug).trim();
  const token = s(body.token).trim();
  const kind = s(body.kind).trim();

  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json(
      { ok: false, error: "invalid_kind" },
      { status: 400 }
    );
  }

  const listing = await authListing(slug, token);
  if (!listing) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }

  const { error } = await supabaseAdmin
    .from("hammerex_yard_comment_reactions")
    .upsert(
      {
        comment_id: commentId,
        reactor_listing_id: listing.id,
        kind
      },
      { onConflict: "comment_id,reactor_listing_id" }
    );
  if (error) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const { id: commentId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const slug = s(body.slug).trim();
  const token = s(body.token).trim();

  const listing = await authListing(slug, token);
  if (!listing) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }

  const { error } = await supabaseAdmin
    .from("hammerex_yard_comment_reactions")
    .delete()
    .eq("comment_id", commentId)
    .eq("reactor_listing_id", listing.id);
  if (error) {
    return NextResponse.json(
      { ok: false, error: "delete_failed", detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
