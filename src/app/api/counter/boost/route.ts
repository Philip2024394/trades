// POST /api/counter/boost
//
// Boost a Counter listing by spending washers from the merchant's bag.
// Duration → washer cost mapping (Philip 2026-07-20 pricing schedule):
//   24h  → 10 washers  ≈ £0.50
//   7d   → 50 washers  ≈ £2.50
//   30d  → 200 washers ≈ £10
//
// Only the listing's poster can boost their own post. Balance-first
// check gives a clean error before touching the wallet OR the post.
// On success: wallet debited, post's boost_expires_at extended,
// analytics event emitted, response returns new balance so the
// composer / listing card can refresh without a round-trip.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdentity } from "@/lib/merchantSession";
import { spendWashers } from "@/lib/washers";
import { trackLiquidity } from "@/lib/analytics/track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Duration = "24h" | "7d" | "30d";
const DURATION_HOURS: Record<Duration, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };
const DURATION_WASHERS: Record<Duration, number> = { "24h": 10, "7d": 50, "30d": 200 };
const DURATION_GBP_PENCE: Record<Duration, number> = { "24h": 50, "7d": 250, "30d": 1000 };

export async function POST(req: Request) {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as {
    postId?:   string;
    duration?: Duration;
  } | null;
  if (!body?.postId || !body.duration || !DURATION_HOURS[body.duration]) {
    return NextResponse.json({ ok: false, error: "postId + valid duration required" }, { status: 400 });
  }

  // Fetch the post + confirm ownership. Only the author of the post
  // can boost it — you can't boost someone else's listing on their
  // behalf.
  const post = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .select("id, author_slug, kind, boost_expires_at, boost_washers_spent")
    .eq("id", body.postId)
    .maybeSingle();
  if (!post.data)                                       return NextResponse.json({ ok: false, error: "post-not-found" }, { status: 404 });
  if (post.data.author_slug !== identity.slug)          return NextResponse.json({ ok: false, error: "not-author" }, { status: 403 });
  if (!["counter", "make-offer", "wanted"].includes(post.data.kind as string)) {
    return NextResponse.json({ ok: false, error: "not-a-counter-post" }, { status: 400 });
  }

  const cost = DURATION_WASHERS[body.duration];

  // Spend washers first — if the wallet check fails, the post is left
  // untouched. This ordering matters: we NEVER want a boost applied to
  // the post without the wallet being debited.
  const spend = await spendWashers({
    merchantSlug: identity.slug,
    amount:       cost,
    source:       "counter-boost",
    detail: {
      postId:   body.postId,
      duration: body.duration,
      gbpEquivPence: DURATION_GBP_PENCE[body.duration]
    }
  });
  if (!spend.ok) {
    if (spend.reason === "insufficient-balance") {
      return NextResponse.json({
        ok:       false,
        error:    "insufficient-washers",
        required: cost,
        balance:  spend.balance ?? 0
      }, { status: 402 });
    }
    return NextResponse.json({ ok: false, error: spend.message }, { status: 500 });
  }

  // Extend boost_expires_at: if a boost is already active + in the
  // future, stack this duration on top. Otherwise start from now.
  const baseMs = post.data.boost_expires_at && new Date(post.data.boost_expires_at as string).getTime() > Date.now()
    ? new Date(post.data.boost_expires_at as string).getTime()
    : Date.now();
  const newExpires = new Date(baseMs + DURATION_HOURS[body.duration] * 3600_000).toISOString();
  const priorPaid  = (post.data.boost_washers_spent as number | null) ?? 0;

  await supabaseAdmin
    .from("hammerex_canteen_posts")
    .update({
      boost_expires_at:     newExpires,
      boost_washers_spent:  priorPaid + cost
    })
    .eq("id", body.postId);

  void trackLiquidity({
    slug:           "counter.boost_paid",
    product:        "trade_center",
    actorKind:      "merchant",
    actorId:        identity.slug,
    lifecycleStage: "supply_available",
    targetKind:     "counter_post",
    targetId:       body.postId,
    metadata: {
      duration:         body.duration,
      washer_cost:      cost,
      gbp_equiv_pence:  DURATION_GBP_PENCE[body.duration],
      new_expires_at:   newExpires
    }
  });

  return NextResponse.json({
    ok:               true,
    balance:          spend.balance,
    washerCost:       cost,
    boostExpiresAt:   newExpires
  });
}
