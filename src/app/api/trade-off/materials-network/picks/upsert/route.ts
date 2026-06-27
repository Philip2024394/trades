// POST /api/trade-off/materials-network/picks/upsert
// Magic-link authenticated. Body: { slug, edit_token, merchant_slug,
// intro_note?, pick_id? }.
//
// When pick_id present → UPDATE intro_note WHERE tradie matches (prevents
// cross-tradie tampering). Otherwise INSERT. Enforces:
// - tradesperson on paid tier AND materials_network add-on enabled
// - target merchant exists, is live, and HAS wholesale_mode addon on
//   (we only let tradies recommend real merchants)
// - cap of MAX_PICKS=12 live picks per tradie
// - intro_note ≤ 200 chars
// - tradie cannot pick themselves

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { effectiveTier } from "@/lib/xratedTrades";
import { isMaterialsNetworkOn } from "@/lib/xratedAddons";
import { MAX_PICKS, constantTimeEq } from "@/lib/xratedMaterialsNetwork";

export const runtime = "nodejs";

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const merchantSlug = s(body.merchant_slug);
  const introNoteRaw = s(body.intro_note);
  const pickId = s(body.pick_id);

  if (!slug || !token || !merchantSlug) {
    return NextResponse.json(
      { ok: false, error: "Missing slug, edit_token, or merchant_slug." },
      { status: 400 }
    );
  }
  if (introNoteRaw.length > 200) {
    return NextResponse.json(
      { ok: false, error: "Intro note must be 200 characters or fewer." },
      { status: 400 }
    );
  }
  const intro_note = introNoteRaw.length === 0 ? null : introNoteRaw;

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, tier, trial_expires_at, addons_enabled, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const tier = effectiveTier({
    tier: listing.data.tier ?? "standard",
    trial_expires_at: listing.data.trial_expires_at ?? null
  });
  const isPaid = tier === "app_trial" || tier === "app_paid";
  if (!isPaid) {
    return NextResponse.json(
      { ok: false, error: "Upgrade required to manage Materials Network picks." },
      { status: 403 }
    );
  }
  const addonsMap =
    listing.data.addons_enabled && typeof listing.data.addons_enabled === "object"
      ? (listing.data.addons_enabled as Record<string, boolean>)
      : {};
  if (!isMaterialsNetworkOn({ addons_enabled: addonsMap })) {
    return NextResponse.json(
      { ok: false, error: "Switch on the Materials Network add-on first." },
      { status: 403 }
    );
  }
  if (listing.data.slug === merchantSlug) {
    return NextResponse.json(
      { ok: false, error: "You cannot recommend your own profile." },
      { status: 400 }
    );
  }

  // Resolve the merchant listing — must exist, be live, and have
  // wholesale_mode on (real merchant signal).
  const merchant = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, status, addons_enabled, display_name")
    .eq("slug", merchantSlug)
    .maybeSingle();

  if (!merchant.data) {
    return NextResponse.json({ ok: false, error: "Merchant not found." }, { status: 404 });
  }
  if (merchant.data.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "Merchant profile is not live." },
      { status: 400 }
    );
  }
  const merchantAddons =
    merchant.data.addons_enabled && typeof merchant.data.addons_enabled === "object"
      ? (merchant.data.addons_enabled as Record<string, boolean>)
      : {};
  if (merchantAddons.wholesale_mode !== true) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "That listing is not running Wholesale Mode — it cannot be picked as a merchant."
      },
      { status: 400 }
    );
  }

  // UPDATE path — only intro_note is mutable (slug + sort_order have
  // their own endpoints). Verify the pick row belongs to this tradie
  // before writing.
  if (pickId) {
    const existing = await supabaseAdmin
      .from("hammerex_xrated_merchant_picks")
      .select("id, tradie_listing_id")
      .eq("id", pickId)
      .maybeSingle();
    if (!existing.data || existing.data.tradie_listing_id !== listing.data.id) {
      return NextResponse.json(
        { ok: false, error: "Pick not found." },
        { status: 404 }
      );
    }
    const upd = await supabaseAdmin
      .from("hammerex_xrated_merchant_picks")
      .update({ intro_note })
      .eq("id", pickId)
      .select("*")
      .maybeSingle();
    if (upd.error || !upd.data) {
      return NextResponse.json(
        { ok: false, error: upd.error?.message ?? "Update failed." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, pick: upd.data });
  }

  // INSERT path — enforce cap + dedupe. The (tradie, merchant) UNIQUE
  // constraint catches a duplicate insert if two tabs race; we surface
  // a clean error rather than 500.
  const countRes = await supabaseAdmin
    .from("hammerex_xrated_merchant_picks")
    .select("id", { count: "exact", head: true })
    .eq("tradie_listing_id", listing.data.id)
    .eq("status", "live");
  if ((countRes.count ?? 0) >= MAX_PICKS) {
    return NextResponse.json(
      {
        ok: false,
        error: `You can pick up to ${MAX_PICKS} merchants. Remove one before adding another.`
      },
      { status: 400 }
    );
  }

  // Next sort_order = max + 1 (so new picks land at the bottom).
  const tail = await supabaseAdmin
    .from("hammerex_xrated_merchant_picks")
    .select("sort_order")
    .eq("tradie_listing_id", listing.data.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (tail.data?.sort_order ?? -1) + 1;

  const ins = await supabaseAdmin
    .from("hammerex_xrated_merchant_picks")
    .insert({
      tradie_listing_id: listing.data.id,
      merchant_listing_id: merchant.data.id,
      intro_note,
      sort_order,
      status: "live"
    })
    .select("*")
    .maybeSingle();

  if (ins.error || !ins.data) {
    // 23505 = unique_violation (the merchant is already picked).
    if (ins.error?.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "You already have this merchant in your picks." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "Insert failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, pick: ins.data });
}
