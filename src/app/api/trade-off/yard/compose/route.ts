// POST /api/trade-off/yard/compose
//
// Auth: body carries { slug, edit_token } (same magic-link pattern as
// /api/trade-off/update). Verifies constant-time, resolves listing.
//
// Behaviour:
//   • Kind is validated against the marketplace + job-board enum.
//   • For "promo" kind, target_audience_slug is REQUIRED and the post
//     is delivered ONLY into hammerex_yard_targeted_notifications for
//     recipients of that trade — it does NOT show in the public feed.
//   • For "commercial" kinds (tools-sell, tools-buy, tools-rent,
//     materials-surplus) the post is exempt from the queue and goes
//     LIVE immediately — they're listings, not feed content.
//   • For every other kind: rate-limit by counting the poster's live
//     posts in the last 24h. First post = live now. 2nd = queued 2h.
//     3rd+ = queued 4-6h with a small jitter to stop batched bursts.

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logBeaconFired, fanoutNewPostToFollowers } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_KINDS = new Set([
  "available",
  "needed",
  "chat",
  "product",
  "job-seek",
  "job-offer",
  "collab-help",
  "tools-sell",
  "tools-buy",
  "tools-rent",
  "materials-surplus",
  "abroad-job",
  "promo",
  "beacon"
]);

// Kinds that are commercial listings — never queued, never rate-limited.
const COMMERCIAL_KINDS = new Set([
  "tools-sell",
  "tools-buy",
  "tools-rent",
  "materials-surplus",
  "product"
]);

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

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function n(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const num = Number.parseFloat(v);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  const slug = s(body.slug).trim();
  const editToken = s(body.edit_token).trim();
  const kind = s(body.kind).trim();
  const title = s(body.title).trim();
  const postBody = s(body.body).trim();

  if (!slug || !editToken) {
    return NextResponse.json(
      { ok: false, error: "missing_auth" },
      { status: 400 }
    );
  }
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json(
      { ok: false, error: "invalid_kind" },
      { status: 400 }
    );
  }
  if (!title || title.length > 140) {
    return NextResponse.json(
      { ok: false, error: "invalid_title" },
      { status: 400 }
    );
  }
  if (!postBody || postBody.length > 2000) {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  const { data: listing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, edit_token, status, primary_trade, city, country, tier, display_name")
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

  // Optional fields
  const region = s(body.region).trim() || null;
  const country = s(body.country).trim() || listing.country || "UK";
  const tradeSlug = s(body.trade_slug).trim() || listing.primary_trade;
  const startDate = s(body.start_date).trim() || null;
  const endDate = s(body.end_date).trim() || null;
  const crewSize = n(body.crew_size_needed);
  const dayRatePence =
    n(body.day_rate_pounds) !== null
      ? Math.round(n(body.day_rate_pounds)! * 100)
      : null;
  const productPricePence =
    n(body.product_price_pounds) !== null
      ? Math.round(n(body.product_price_pounds)! * 100)
      : null;
  const imageUrls: string[] = Array.isArray(body.image_urls)
    ? (body.image_urls as unknown[])
        .map((u) => (typeof u === "string" ? u.trim() : ""))
        .filter(Boolean)
        .slice(0, 6)
    : [];
  // Mood character slug — validated against a small whitelist so a
  // stray value can't stuff arbitrary content into metadata. Kept in
  // sync with src/lib/yardMoods.ts MOOD_ORDER.
  const ALLOWED_MOODS = new Set([
    "confused",
    "thinking",
    "frustrated",
    "celebrating",
    "laughing",
    "asleep"
  ]);
  const moodInput = s(body.mood).trim();
  const moodSlug = ALLOWED_MOODS.has(moodInput) ? moodInput : null;
  const moodMetadata = moodSlug ? { mood: moodSlug } : null;
  const linkUrl = s(body.link_url).trim() || null;
  const linkTitle = s(body.link_title).trim() || null;
  const targetAudienceSlugRaw =
    s(body.target_audience_slug).trim() || null;

  // ─── Marketplace commerce fields ─────────────────────────────────
  // Only meaningful for the marketplace kinds; the DB accepts nulls /
  // defaults for other kinds so we don't gate here — the composer UI
  // is what decides when to render them.
  const ALLOWED_CURRENCIES = new Set(["GBP", "USD", "EUR"]);
  const ALLOWED_CONDITIONS = new Set([
    "new",
    "used-like-new",
    "used-good",
    "used-fair",
    "for-parts"
  ]);
  const ALLOWED_WARRANTY = new Set([
    "manufacturer",
    "seller-warranty",
    "sold-as-seen"
  ]);
  const ALLOWED_DELIVERY = new Set([
    "collection",
    "local-delivery",
    "uk-shipping",
    "international"
  ]);

  const priceCurrencyRaw = s(body.price_currency).trim().toUpperCase();
  const priceCurrency = ALLOWED_CURRENCIES.has(priceCurrencyRaw)
    ? priceCurrencyRaw
    : "GBP";

  const conditionRaw = s(body.condition).trim();
  const condition = ALLOWED_CONDITIONS.has(conditionRaw) ? conditionRaw : null;

  const warrantyRaw = s(body.warranty_status).trim();
  const warrantyStatus = ALLOWED_WARRANTY.has(warrantyRaw)
    ? warrantyRaw
    : null;

  const stockQtyN = n(body.stock_qty);
  const stockQty =
    stockQtyN !== null && stockQtyN >= 0 ? Math.floor(stockQtyN) : 1;

  const deliveryOptions: string[] = Array.isArray(body.delivery_options)
    ? (body.delivery_options as unknown[])
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter((v) => ALLOWED_DELIVERY.has(v))
    : [];

  const deliveryFreeOverPence =
    n(body.delivery_free_over_pounds) !== null
      ? Math.round(n(body.delivery_free_over_pounds)! * 100)
      : null;

  // ─── Video attachments (paid-tier only) ──────────────────────────
  const videoUrlsRaw: string[] = Array.isArray(body.video_urls)
    ? (body.video_urls as unknown[])
        .map((u) => (typeof u === "string" ? u.trim() : ""))
        .filter(Boolean)
        .slice(0, 1)
    : [];

  // ─── Promo posts: targeted delivery, no public feed ──────────────
  // Free tier: 1 audience per promo (backwards-compat with singular slug).
  // Paid tier (app_trial / app_paid / verified): up to 3 audiences via
  // `target_audience_slugs` array.
  const paidTiers = new Set(["app_trial", "app_paid", "verified"]);
  const listingTier = (listing as { tier?: string }).tier ?? "standard";
  const isPaidTier = paidTiers.has(listingTier);
  const audienceArray = Array.isArray(body.target_audience_slugs)
    ? (body.target_audience_slugs as unknown[])
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
    : [];
  const targetAudienceSlugs =
    audienceArray.length > 0
      ? audienceArray
      : targetAudienceSlugRaw
        ? [targetAudienceSlugRaw]
        : [];

  // Belt-and-braces video paid-tier gate. Upload endpoint already
  // rejects standard-tier bytes; this catches API bypass attempts.
  if (videoUrlsRaw.length > 0 && !isPaidTier) {
    return NextResponse.json(
      {
        ok: false,
        error: "video_requires_paid",
        detail:
          "Video posts are a paid-tier feature. Upgrade to include video in your Yard posts."
      },
      { status: 403 }
    );
  }

  if (kind === "promo") {
    if (targetAudienceSlugs.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "promo_needs_audience",
          detail:
            "Promotional posts must target at least one trade audience — required to protect the feed."
        },
        { status: 400 }
      );
    }
    if (!isPaidTier && targetAudienceSlugs.length > 1) {
      return NextResponse.json(
        {
          ok: false,
          error: "free_tier_single_audience",
          detail:
            "Free-tier listings can target one audience per promo. Upgrade to broadcast to multiple trades."
        },
        { status: 403 }
      );
    }
    if (targetAudienceSlugs.length > 3) {
      return NextResponse.json(
        { ok: false, error: "too_many_audiences" },
        { status: 400 }
      );
    }
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("hammerex_trade_off_yard_posts")
      .insert({
        listing_id: listing.id,
        kind: "promo",
        trade_slug: tradeSlug,
        title,
        body: postBody,
        country,
        region,
        image_urls: imageUrls,
        video_urls: videoUrlsRaw,
        link_url: linkUrl,
        link_title: linkTitle,
        product_price_pence: productPricePence,
        price_currency: priceCurrency,
        condition,
        warranty_status: warrantyStatus,
        stock_qty: stockQty,
        delivery_options: deliveryOptions,
        delivery_free_over_pence: deliveryFreeOverPence,
        // Primary audience on the row (back-compat); the multi-audience
        // fanout below carries the rest.
        target_audience_slug: targetAudienceSlugs[0],
        audience_reach: "targeted",
        status: "live",
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      return NextResponse.json(
        { ok: false, error: "insert_failed", detail: insErr?.message },
        { status: 500 }
      );
    }
    // Fan-out to notifications for every trade whose primary_trade
    // matches ANY of the target audiences — except the poster.
    const { data: recipients } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id")
      .in("primary_trade", targetAudienceSlugs)
      .eq("status", "live")
      .neq("id", listing.id);
    if (recipients && recipients.length > 0) {
      const rows = recipients.map((r) => ({
        recipient_listing_id: r.id,
        source_post_id: inserted.id
      }));
      await supabaseAdmin
        .from("hammerex_yard_targeted_notifications")
        .upsert(rows, { onConflict: "recipient_listing_id,source_post_id" });
    }
    return NextResponse.json({
      ok: true,
      postId: inserted.id,
      delivery: "targeted",
      recipientCount: recipients?.length ?? 0
    });
  }

  // ─── Beacon posts: "need this now" — geolocated, time-boxed ──────
  // A beacon carries its own expiry (30/60 min from now), coordinates
  // and a broadcast radius. No rate-limit / queue — beacons are
  // urgent by definition. Expiry defaults to 30 min; caller can pass
  // beacon_duration_minutes to set 30 or 60.
  if (kind === "beacon") {
    const rawDuration =
      typeof body.beacon_duration_minutes === "number"
        ? body.beacon_duration_minutes
        : 30;
    const beaconMinutes = rawDuration === 60 ? 60 : 30;
    const beaconExpires = new Date(
      Date.now() + beaconMinutes * 60 * 1000
    ).toISOString();
    const bLat = n(body.beacon_lat);
    const bLng = n(body.beacon_lng);
    const bRadiusN = n(body.beacon_radius_km);
    const beaconRadius =
      bRadiusN !== null && bRadiusN >= 1 && bRadiusN <= 200
        ? Math.round(bRadiusN)
        : 10;

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("hammerex_trade_off_yard_posts")
      .insert({
        listing_id: listing.id,
        kind: "beacon",
        trade_slug: tradeSlug,
        title,
        body: postBody,
        country,
        region,
        image_urls: imageUrls,
        video_urls: videoUrlsRaw,
        beacon_expires_at: beaconExpires,
        beacon_lat: bLat,
        beacon_lng: bLng,
        beacon_radius_km: beaconRadius,
        audience_reach: "feed",
        status: "live",
        // The post's own expires_at is the beacon expiry, not the
        // standard 14 days — beacons are ephemeral by design.
        expires_at: beaconExpires
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      return NextResponse.json(
        { ok: false, error: "insert_failed", detail: insErr?.message },
        { status: 500 }
      );
    }

    // Activity fanout — public event for the landing widget +
    // personal event to every trade matching the beacon's trade slug
    // so their notification inbox lights up. Fire-and-forget; failures
    // never block the beacon itself.
    try {
      const { data: matches } = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id")
        .eq("primary_trade", tradeSlug)
        .eq("status", "live")
        .neq("id", listing.id)
        .limit(200);
      await logBeaconFired({
        beacon_id: inserted.id,
        poster_listing_id: listing.id,
        poster_display_name: listing.display_name ?? "Member",
        poster_trade: tradeSlug,
        poster_city: region ?? listing.city ?? null,
        title,
        region,
        beacon_expires_at: beaconExpires,
        match_trade_listing_ids: (matches ?? []).map((r) => r.id)
      });
    } catch {
      /* swallow */
    }

    return NextResponse.json({
      ok: true,
      postId: inserted.id,
      delivery: "beacon",
      beaconExpiresAt: beaconExpires,
      beaconRadiusKm: beaconRadius
    });
  }

  // ─── Rate limit + queue for non-commercial, non-promo kinds ──────
  let status: "live" | "queued" = "live";
  let scheduledReleaseAt: string | null = null;
  if (!COMMERCIAL_KINDS.has(kind)) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabaseAdmin
      .from("hammerex_trade_off_yard_posts")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.id)
      .in("status", ["live", "queued"])
      .gt("created_at", oneDayAgo);
    const c = recentCount ?? 0;
    if (c === 0) {
      status = "live";
    } else if (c === 1) {
      status = "queued";
      scheduledReleaseAt = new Date(
        Date.now() + 2 * 60 * 60 * 1000
      ).toISOString();
    } else {
      // 3rd+ — 4-6h jitter, keeps a rapid poster from clumping.
      const jitterMs = 4 * 60 * 60 * 1000 + Math.floor(Math.random() * 2 * 60 * 60 * 1000);
      status = "queued";
      scheduledReleaseAt = new Date(Date.now() + jitterMs).toISOString();
    }
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .insert({
      listing_id: listing.id,
      kind,
      trade_slug: tradeSlug,
      title,
      body: postBody,
      country,
      region,
      start_date: startDate,
      end_date: endDate,
      crew_size_needed: crewSize,
      day_rate_pence: dayRatePence,
      product_price_pence: productPricePence,
      price_currency: priceCurrency,
      condition,
      warranty_status: warrantyStatus,
      stock_qty: stockQty,
      delivery_options: deliveryOptions,
      delivery_free_over_pence: deliveryFreeOverPence,
      image_urls: imageUrls,
      video_urls: videoUrlsRaw,
      link_url: linkUrl,
      link_title: linkTitle,
      audience_reach: "feed",
      status,
      scheduled_release_at: scheduledReleaseAt,
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      // Mood metadata — only written when the composer picked one OR
      // the auto-suggestion was accepted. Column default is '{}'::jsonb,
      // so omitting the key keeps existing posts untouched.
      ...(moodMetadata ? { metadata: moodMetadata } : {})
    })
    .select("id, status, scheduled_release_at")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", detail: insErr?.message },
      { status: 500 }
    );
  }

  // Fan out to followers — every non-chat post kind notifies the
  // poster's audience. Chat posts are noisy; excluded on purpose.
  // Fire-and-forget so a slow fanout never blocks the compose response.
  if (kind !== "chat") {
    try {
      const displayName = listing.display_name ?? "Member";
      await fanoutNewPostToFollowers({
        post_id: inserted.id,
        poster_listing_id: listing.id,
        poster_display_name: displayName,
        poster_trade: tradeSlug,
        post_kind: kind,
        post_title: title,
        action_url: `/trade-off/yard/${inserted.id}`
      });
    } catch {
      /* swallow — best-effort */
    }
  }

  return NextResponse.json({
    ok: true,
    postId: inserted.id,
    delivery: inserted.status,
    scheduledReleaseAt: inserted.scheduled_release_at
  });
}
