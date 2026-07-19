// POST /api/canteens/posts/[id]/boost   { hours }
//
// Boost a canteen post — extends boost_expires_at by N hours and
// deducts N washers (1 washer per hour). Only the post author can
// boost their own post. Cookie-session auth via getMerchantSlug.
//
// Boosted posts sort second in the canteen feed (after pinned).
// Cost: 1 washer per hour, capped 1..168 hours (7 days).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_HOURS = 1;
const MAX_HOURS = 168;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const callerSlug = await getMerchantSlug();
  if (!callerSlug) return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });

  let body: { hours?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  const hoursRaw = Number(body.hours);
  if (!Number.isFinite(hoursRaw)) {
    return NextResponse.json({ ok: false, error: "invalid-hours" }, { status: 400 });
  }
  const hours = Math.max(MIN_HOURS, Math.min(MAX_HOURS, Math.round(hoursRaw)));

  const post = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .select("id, author_slug, author_listing_id, boost_expires_at, boost_washers_spent")
    .eq("id", id)
    .maybeSingle();
  if (!post.data) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  if (post.data.author_slug !== callerSlug) {
    return NextResponse.json({ ok: false, error: "not-author" }, { status: 403 });
  }

  const listingId = post.data.author_listing_id as string | null;
  if (!listingId) {
    return NextResponse.json({ ok: false, error: "listing-unresolvable" }, { status: 500 });
  }

  const bag = await supabaseAdmin
    .from("hammerex_washer_bags")
    .select("id, balance")
    .eq("listing_id", listingId)
    .maybeSingle();
  const balance = (bag.data?.balance as number | undefined) ?? 0;
  if (balance < hours) {
    return NextResponse.json({
      ok:     false,
      error:  "insufficient-washers",
      detail: `Need ${hours} washers for a ${hours}h boost. Balance: ${balance}. Top up in /washers.`
    }, { status: 402 });
  }
  await supabaseAdmin
    .from("hammerex_washer_bags")
    .update({ balance: balance - hours })
    .eq("id", bag.data!.id as string);

  const now = new Date();
  const existing = post.data.boost_expires_at ? new Date(post.data.boost_expires_at as string) : now;
  const base = existing > now ? existing : now;
  const nextExpires = new Date(base.getTime() + hours * 3600 * 1000);
  const totalSpent = ((post.data.boost_washers_spent as number) ?? 0) + hours;

  await supabaseAdmin
    .from("hammerex_canteen_posts")
    .update({
      boost_expires_at:    nextExpires.toISOString(),
      boost_washers_spent: totalSpent
    })
    .eq("id", id);

  return NextResponse.json({
    ok:                true,
    boost_expires_at:  nextExpires.toISOString(),
    washers_deducted:  hours,
    new_bag_balance:   balance - hours
  });
}
