// The Yard v3 — inline comments API.
//
// GET  /api/trade-off/yard/posts/[id]/comments
//        Returns top-level + threaded comments for the post, with
//        author identity + per-comment reaction counts.
//
// POST /api/trade-off/yard/posts/[id]/comments
//        Body: { slug, edit_token, body, parent_comment_id? }
//        Trades-only (magic-link auth). Nested replies get flattened
//        to the same parent (one level max) to keep mobile UX sane.
//
// Public read: anyone can GET the list — commenting requires a valid
// trade listing. Homeowners view but never post.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logCommentReply } from "@/lib/activity";
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

export async function GET(_req: Request, ctx: RouteCtx) {
  const { id: postId } = await ctx.params;
  if (!postId) {
    return NextResponse.json(
      { ok: false, error: "missing_post_id" },
      { status: 400 }
    );
  }

  const { data: comments, error } = await supabaseAdmin
    .from("hammerex_yard_comments")
    .select(
      "id, post_id, author_listing_id, parent_comment_id, body, created_at, edited_at, flag_count"
    )
    .eq("post_id", postId)
    .is("deleted_at", null)
    .eq("moderation_status", "live")
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "query_failed", detail: error.message },
      { status: 500 }
    );
  }

  // Resolve authors in one shot
  const authorIds = Array.from(
    new Set((comments ?? []).map((c) => c.author_listing_id))
  );
  const authors: Record<
    string,
    {
      slug: string;
      display_name: string;
      trading_name: string | null;
      avatar_url: string | null;
      primary_trade: string;
    }
  > = {};
  if (authorIds.length > 0) {
    const { data: rows } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name, trading_name, avatar_url, primary_trade")
      .in("id", authorIds);
    for (const r of rows ?? []) {
      authors[r.id] = {
        slug: r.slug,
        display_name: r.display_name,
        trading_name: r.trading_name,
        avatar_url: r.avatar_url,
        primary_trade: r.primary_trade
      };
    }
  }

  // Per-comment reaction counts
  const commentIds = (comments ?? []).map((c) => c.id);
  const reactions: Record<string, { like: number; dislike: number }> = {};
  if (commentIds.length > 0) {
    const { data: rxRows } = await supabaseAdmin
      .from("hammerex_yard_comment_reactions")
      .select("comment_id, kind")
      .in("comment_id", commentIds);
    for (const r of rxRows ?? []) {
      const entry = reactions[r.comment_id] ?? { like: 0, dislike: 0 };
      if (r.kind === "like") entry.like += 1;
      else if (r.kind === "dislike") entry.dislike += 1;
      reactions[r.comment_id] = entry;
    }
  }

  const shaped = (comments ?? []).map((c) => ({
    id: c.id,
    parentCommentId: c.parent_comment_id,
    body: c.body,
    createdAt: c.created_at,
    editedAt: c.edited_at,
    author: authors[c.author_listing_id] ?? null,
    reactions: reactions[c.id] ?? { like: 0, dislike: 0 }
  }));

  return NextResponse.json({ ok: true, comments: shaped });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { id: postId } = await ctx.params;
  if (!postId) {
    return NextResponse.json(
      { ok: false, error: "missing_post_id" },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  const commentBody = s(body.body).trim();
  const parentCommentIdRaw = s(body.parent_comment_id).trim();
  const parentCommentId = parentCommentIdRaw || null;

  if (!commentBody || commentBody.length > 2000) {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  // Auth precedence:
  //   1. body { slug, edit_token }  — magic-link callers
  //   2. HMAC-signed trade session cookie — Dev · Pass + normal login
  // Either path resolves to a `listing` row that owns this comment.
  const providedSlug = s(body.slug).trim();
  const providedToken = s(body.edit_token).trim();
  let listing: { id: string; edit_token: string; status: string } | null = null;

  if (providedSlug && providedToken) {
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, edit_token, status")
      .eq("slug", providedSlug)
      .maybeSingle();
    if (data && constantTimeEq(data.edit_token, providedToken)) {
      listing = data;
    }
  }

  if (!listing) {
    const session = readTradeSession(req as NextRequest);
    if (session?.listing_id) {
      const { data } = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id, edit_token, status")
        .eq("id", session.listing_id)
        .maybeSingle();
      if (data) listing = data;
    }
  }

  if (!listing) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }
  if (listing.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "listing_not_live" },
      { status: 403 }
    );
  }

  // Confirm the target post exists (also flattens nested replies).
  const { data: postRow } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id, listing_id")
    .eq("id", postId)
    .maybeSingle();
  if (!postRow) {
    return NextResponse.json(
      { ok: false, error: "post_not_found" },
      { status: 404 }
    );
  }

  // Flatten reply-to-reply. If the parent is itself a reply, we hop up
  // to its parent so we never exceed one level of nesting.
  let effectiveParentId: string | null = null;
  if (parentCommentId) {
    const { data: parent } = await supabaseAdmin
      .from("hammerex_yard_comments")
      .select("id, parent_comment_id, post_id")
      .eq("id", parentCommentId)
      .maybeSingle();
    if (parent && parent.post_id === postId) {
      effectiveParentId = parent.parent_comment_id ?? parent.id;
    }
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("hammerex_yard_comments")
    .insert({
      post_id: postId,
      author_listing_id: listing.id,
      parent_comment_id: effectiveParentId,
      body: commentBody
    })
    .select("id, created_at")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", detail: insErr?.message },
      { status: 500 }
    );
  }

  // Log to the activity feed — personal ping to the post owner (unless
  // they're commenting on their own post), plus a public anonymised
  // event for the landing widget. Fire-and-forget; never blocks the
  // comment write.
  if (postRow.listing_id !== listing.id) {
    const { data: commenter } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("display_name, trading_name, primary_trade, city")
      .eq("id", listing.id)
      .maybeSingle();
    if (commenter) {
      const displayName =
        commenter.trading_name?.trim() || commenter.display_name || "Member";
      logCommentReply({
        post_id: postId,
        post_owner_listing_id: postRow.listing_id,
        commenter_listing_id: listing.id,
        commenter_display_name: displayName,
        commenter_trade: commenter.primary_trade,
        commenter_city: commenter.city ?? null,
        comment_id: inserted.id
      });
    }
  }

  return NextResponse.json({
    ok: true,
    commentId: inserted.id,
    createdAt: inserted.created_at,
    parentCommentId: effectiveParentId
  });
}
