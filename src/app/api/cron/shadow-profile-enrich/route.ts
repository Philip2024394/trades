// GET /api/cron/shadow-profile-enrich
//
// Runs hourly. For each shadow merchant with no email + fewer than
// 3 enrichment attempts, cross-references Google Places to find their
// phone/website/reviews, then follows the website to scrape a business
// email.
//
// Runs BETWEEN the scrape cron (nightly) and the send cron (every
// 15 min business hours) — bridges the CH-only skeleton with contact
// info required for the drip sequence.
//
// After 3 unsuccessful attempts a merchant is auto-released as
// 'unreachable' — prevents infinite retry loops on businesses that
// have no online presence.
//
// Cost budget: Google Places ~£0.028 per merchant; 100 merchants
// enriched per run × 24 runs = 2,400/day = ~£67/mo at full tilt.
//
// CRON_SECRET gated.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findPlace } from "@/lib/shadowMerchants/googlePlaces";
import { findEmailFromWebsite } from "@/lib/shadowMerchants/websiteScraper";
import type { ShadowMerchant } from "@/lib/shadowMerchants/types";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 300;

const MAX_ENRICH_PER_RUN = 100;
const MAX_ATTEMPTS = 3;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (secret && bearer !== secret) {
    return NextResponse.json({ ok: false, error: "not-authorised" }, { status: 401 });
  }

  const now = new Date();

  // Pull the next batch — no email, <3 attempts, in scraped/queued
  const dueRes = await supabaseAdmin
    .from("hammerex_shadow_merchants")
    .select("*")
    .in("status", ["scraped", "queued"])
    .is("email", null)
    .lt("enrichment_attempts", MAX_ATTEMPTS)
    .order("enriched_at", { ascending: true, nullsFirst: true })
    .limit(MAX_ENRICH_PER_RUN);

  if (dueRes.error) {
    console.error("[cron/shadow-profile-enrich] fetch failed", dueRes.error);
    return NextResponse.json({ ok: false, error: "fetch-failed" }, { status: 500 });
  }

  const merchants = (dueRes.data ?? []) as ShadowMerchant[];

  let placesHit    = 0;
  let placesMiss   = 0;
  let emailFound   = 0;
  let phoneFound   = 0;
  let websiteFound = 0;
  let releasedUnreachable = 0;

  for (const m of merchants) {
    const attempts = (m.enrichment_attempts ?? 0) + 1;
    const updates: Partial<ShadowMerchant> & Record<string, unknown> = {
      enriched_at:         now.toISOString(),
      enrichment_attempts: attempts
    };

    let sourceUsed: string = "none";

    // 1. Google Places lookup
    const place = await findPlace({
      businessName: m.business_name,
      city:         m.city,
      postcode:     m.postcode
    });

    if (place) {
      placesHit++;
      updates.gbp_place_id     = place.placeId;
      updates.gbp_star_rating  = place.starRating;
      updates.gbp_review_count = place.reviewCount;
      if (place.phone)   { updates.phone   = place.phone;   phoneFound++; }
      if (place.website) { updates.website = place.website; websiteFound++; }
      sourceUsed = "google_places";
    } else {
      placesMiss++;
    }

    // 2. Website email scrape (if we now have a website URL)
    const websiteToScrape = (updates.website as string | undefined) || m.website;
    if (websiteToScrape && !m.email) {
      try {
        const foundEmail = await findEmailFromWebsite(websiteToScrape);
        if (foundEmail) {
          updates.email = foundEmail;
          emailFound++;
          sourceUsed = sourceUsed === "google_places" ? "google_places+website" : "website";
        }
      } catch (err) {
        console.warn(`[cron/shadow-profile-enrich] website scrape failed for ${m.reserved_slug}`, err);
      }
    }

    // 3. If we found an email, promote to 'queued' + eligible now
    if (updates.email) {
      updates.status            = "queued";
      updates.next_step_due_at  = now.toISOString();
      updates.next_step_index   = m.next_step_index ?? 0;
      updates.enrichment_source = sourceUsed;
    } else if (attempts >= MAX_ATTEMPTS) {
      // 4. Give up after MAX_ATTEMPTS with no email — release
      updates.status            = "released";
      updates.released_at       = now.toISOString();
      updates.enrichment_source = "none";
      releasedUnreachable++;
    }

    const upd = await supabaseAdmin
      .from("hammerex_shadow_merchants")
      .update(updates)
      .eq("id", m.id);

    if (upd.error) {
      console.error(`[cron/shadow-profile-enrich] update failed for ${m.reserved_slug}`, upd.error);
    }

    // Small throttle between Google Places calls — helps avoid rate limits + gives websites breathing room
    await new Promise((r) => setTimeout(r, 300));
  }

  const summary = {
    ok:                  true,
    batchSize:           merchants.length,
    placesHit,
    placesMiss,
    emailFound,
    phoneFound,
    websiteFound,
    releasedUnreachable,
    at:                  now.toISOString()
  };
  console.log("[cron/shadow-profile-enrich]", summary);
  return NextResponse.json(summary);
}
