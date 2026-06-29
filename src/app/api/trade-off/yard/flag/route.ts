// POST /api/trade-off/yard/flag
//
// Public-from-paid-member flagging endpoint. The member's listing acts
// as their identity (one flag per listing per post — enforced by the
// (post_id, listing_id) UNIQUE on hammerex_trade_off_yard_flags). The
// edit_token is the per-listing magic-link token issued during signup,
// already used everywhere else as the member-action gate.
//
// Body: either
//   { post_id, listing_id, edit_token, reason? }
//   { post_id, slug, token,      reason? }   (preferred client shape — matches /reactions)
// Returns: { ok: true, flag_count, auto_flagged } on success, 4xx on
// bad input, 5xx on DB error.
//
// When a post's flag_count reaches AUTO_FLAG_THRESHOLD it auto-flips
// moderation_status to 'flagged' so it surfaces in the admin queue.
// The post stays VISIBLE to members at that point — only admin
// actions ('hide'/'spam') hide it from the public feed.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// How many distinct community flags it takes to auto-flip the post to
// 'flagged' status. Sensible default — admin can tune by editing this
// constant rather than chasing a DB migration. Lower for a brand-new
// community where signal density is thin; higher once volume grows.
const AUTO_FLAG_THRESHOLD = 3;

const REASON_MAX = 280;

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const post_id = s(payload.post_id);
  // Accept either {listing_id, edit_token} or {slug, token} — both
  // shapes get resolved to a listing row + verified against the
  // edit_token column.
  const listing_id_in = s(payload.listing_id);
  const edit_token_in = s(payload.edit_token);
  const slug_in = s(payload.slug);
  const token_in = s(payload.token);
  const tokenForCheck = edit_token_in || token_in;
  const reasonRaw = s(payload.reason);
  const reason = reasonRaw.length > REASON_MAX
    ? reasonRaw.slice(0, REASON_MAX)
    : reasonRaw || null;

  if (!post_id || (!listing_id_in && !slug_in) || !tokenForCheck) {
    return NextResponse.json(
      { ok: false, error: "Missing post_id, listing_id/slug, or edit_token" },
      { status: 400 }
    );
  }

  // Verify the edit_token against the listing — the same gate every
  // other member action uses. We don't gate on tier here: anyone with a
  // valid token can flag, including builder-grade free users.
  const listingQuery = supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token");
  const listing = await (listing_id_in
    ? listingQuery.eq("id", listing_id_in).maybeSingle()
    : listingQuery.eq("slug", slug_in).maybeSingle());
  if (!listing.data) {
    return NextResponse.json(
      { ok: false, error: "Listing not found" },
      { status: 404 }
    );
  }
  if (!constantTimeEq(tokenForCheck, listing.data.edit_token ?? "")) {
    return NextResponse.json(
      { ok: false, error: "Bad token" },
      { status: 403 }
    );
  }
  const listing_id = listing.data.id;

  // Confirm the post exists before bumping anything.
  const post = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id, flag_count, moderation_status")
    .eq("id", post_id)
    .maybeSingle();
  if (!post.data) {
    return NextResponse.json(
      { ok: false, error: "Post not found" },
      { status: 404 }
    );
  }

  // INSERT ... ON CONFLICT DO NOTHING — one flag per (post, listing).
  // We rely on the UNIQUE index added by the migration. If the row
  // already exists, the insert succeeds-with-no-row and we skip the
  // counter bump (idempotent re-flag).
  const flagIns = await supabaseAdmin
    .from("hammerex_trade_off_yard_flags")
    .upsert(
      { post_id, listing_id, reason },
      { onConflict: "post_id,listing_id", ignoreDuplicates: true }
    )
    .select("id");
  if (flagIns.error) {
    console.error("[yard/flag] insert failed:", flagIns.error);
    return NextResponse.json(
      { ok: false, error: flagIns.error.message },
      { status: 500 }
    );
  }

  // If upsert returned no row, the flag already existed — short-circuit
  // so we don't double-count. Re-read the current flag_count so the
  // client can show the latest count.
  if (!flagIns.data || flagIns.data.length === 0) {
    return NextResponse.json({
      ok: true,
      flag_count: post.data.flag_count,
      auto_flagged: post.data.moderation_status === "flagged",
      already_flagged: true
    });
  }

  const newFlagCount = (post.data.flag_count ?? 0) + 1;
  const shouldAutoFlag =
    newFlagCount >= AUTO_FLAG_THRESHOLD &&
    post.data.moderation_status === "live";

  const patch: Record<string, unknown> = { flag_count: newFlagCount };
  if (shouldAutoFlag) patch.moderation_status = "flagged";

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .update(patch)
    .eq("id", post_id);
  if (upd.error) {
    console.error("[yard/flag] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    flag_count: newFlagCount,
    auto_flagged: shouldAutoFlag || post.data.moderation_status === "flagged"
  });
}
