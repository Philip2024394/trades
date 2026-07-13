// POST /api/trade-off/yard/posts/[id]/boost
//
// Extend or apply a boost on the trade's own Yard post.
//
// Request body: { slug, edit_token, hours }
//   hours ∈ { 24, 48 }   ← v1 supports two durations, matches the two
//                          price tiers in the boost modal.
//
// V1 payment flow: not wired to Stripe yet. This endpoint APPLIES the
// boost immediately (records boost_paid_pence: 0) so we can validate
// the mechanic end-to-end while the payment integration lands. When
// Stripe checkout is wired, we'll require a stripe_session_id in the
// body and only apply the boost after the webhook confirms payment.
// The DB writes here are identical either way — only the auth gate
// changes.
//
// Auth: constant-time slug + edit_token, and the caller MUST own the
// post (post.listing_id === listing.id).

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOURS = new Set([24, 48]);

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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  const slug = s(body.slug).trim();
  const editToken = s(body.edit_token).trim();
  const hours = typeof body.hours === "number" ? body.hours : 24;

  if (!slug || !editToken) {
    return NextResponse.json(
      { ok: false, error: "missing_auth" },
      { status: 401 }
    );
  }
  if (!ALLOWED_HOURS.has(hours)) {
    return NextResponse.json(
      { ok: false, error: "invalid_hours" },
      { status: 400 }
    );
  }

  const { data: listing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing || !constantTimeEq(listing.edit_token, editToken)) {
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

  // Ownership check — a trade can only boost their own posts.
  const { data: post } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id, listing_id, is_boosted_until, boost_count, boost_paid_pence")
    .eq("id", postId)
    .maybeSingle();
  if (!post) {
    return NextResponse.json(
      { ok: false, error: "post_not_found" },
      { status: 404 }
    );
  }
  if (post.listing_id !== listing.id) {
    return NextResponse.json(
      { ok: false, error: "not_post_owner" },
      { status: 403 }
    );
  }

  // Extend from now OR from the existing boost end, whichever is
  // later — so re-boosting a still-live boost adds duration on top
  // of what's left, not replacing it.
  const now = Date.now();
  const existing = post.is_boosted_until
    ? Date.parse(post.is_boosted_until)
    : 0;
  const startFrom = Number.isFinite(existing) && existing > now ? existing : now;
  const newUntil = new Date(startFrom + hours * 60 * 60 * 1000).toISOString();

  const { error: updErr } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .update({
      is_boosted_until: newUntil,
      boost_count: (post.boost_count ?? 0) + 1
      // boost_paid_pence stays 0 in v1 — bump this when Stripe wired.
    })
    .eq("id", post.id);

  if (updErr) {
    return NextResponse.json(
      { ok: false, error: "update_failed", detail: updErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    boostedUntil: newUntil,
    hoursApplied: hours
  });
}
