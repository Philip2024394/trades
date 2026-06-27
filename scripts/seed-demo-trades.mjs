// Seed 27 demo trade profiles + their reviews into Supabase.
//
// Reads DEMO_TRADE_SEEDS from src/lib/demoTradeSeeds.ts and inserts each one
// into hammerex_trade_off_listings (idempotent via ON CONFLICT (slug)).
// Then inserts the seed's reviews into hammerex_xrated_reviews keyed by
// the listing's id.
//
// Run: node scripts/seed-demo-trades.mjs

import { readFileSync } from "node:fs";
import { DEMO_TRADE_SEEDS } from "../src/lib/demoTradeSeeds.ts";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

async function query(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Supabase ${r.status}: ${txt}`);
  }
  return r.json();
}

function esc(s) {
  if (s === null || s === undefined) return "NULL";
  if (typeof s === "number") return s.toString();
  if (typeof s === "boolean") return s ? "true" : "false";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function arr(items) {
  if (!items || !items.length) return "ARRAY[]::text[]";
  return "ARRAY[" + items.map(esc).join(",") + "]::text[]";
}

let insertedListings = 0;
let skippedListings = 0;
let insertedReviews = 0;

for (const seed of DEMO_TRADE_SEEDS) {
  const waDigits = seed.whatsapp.replace(/\D/g, "");

  const pricedJson = JSON.stringify(
    seed.priced_services.map((s) => ({
      name: s.name,
      price: s.price,
      unit: s.unit,
      description: s.description,
      image_url: null,
    }))
  );
  const faqJson = JSON.stringify(seed.faq_items.map((f) => ({ q: f.q, a: f.a })));

  const listingSql = `
    INSERT INTO hammerex_trade_off_listings (
      slug, display_name, trading_name, primary_trade, secondary_trades,
      city, country, postcode_prefix, whatsapp, email, bio,
      years_in_trade, start_year, is_insured, insurance_cover_gbp,
      qualifications, trade_memberships, dbs_checked,
      has_own_transport, has_own_tools, minimum_job_gbp, free_site_visits,
      quote_availability, quote_turnaround_hours, current_status_note,
      availability, priced_services, faq_items, status, tier,
      contact_form_enabled, visit_us_enabled, theme_color, button_text_color,
      report_count, paid_expires_at, joined_at, edit_token
    )
    VALUES (
      ${esc(seed.profile_slug)}, ${esc(seed.display_name)}, ${esc(seed.trading_name)},
      ${esc(seed.trade_slug)}, ARRAY[]::text[],
      ${esc(seed.city)}, 'United Kingdom', ${esc(seed.postcode_prefix)},
      ${esc(waDigits)}, ${esc(seed.email)}, ${esc(seed.bio)},
      ${seed.years_in_trade}, ${seed.start_year},
      ${seed.is_insured}, ${seed.insurance_cover_gbp},
      ${arr(seed.qualifications)}, ${arr(seed.trade_memberships)},
      ${seed.dbs_checked}, ${seed.has_own_transport}, ${seed.has_own_tools},
      ${seed.minimum_job_gbp}, ${seed.free_site_visits},
      ${esc(seed.quote_availability)}, ${seed.quote_turnaround_hours},
      ${esc(seed.current_status_note)}, ${esc(seed.availability)},
      ${esc(pricedJson)}::jsonb, ${esc(faqJson)}::jsonb,
      'live', 'app_paid', true, false, '#FFB300', '#FFFFFF',
      0, now() + interval '5 years',
      now() - (random() * interval '700 days') - interval '30 days',
      gen_random_uuid()
    )
    ON CONFLICT (slug) DO NOTHING
    RETURNING id, slug;
  `;

  const result = await query(listingSql);
  let listingId;
  if (Array.isArray(result) && result.length > 0 && result[0].id) {
    listingId = result[0].id;
    insertedListings++;
    console.log(`+ inserted ${seed.profile_slug}`);
  } else {
    // Already existed — fetch its id.
    const existing = await query(
      `SELECT id FROM hammerex_trade_off_listings WHERE slug = ${esc(seed.profile_slug)};`
    );
    if (!Array.isArray(existing) || !existing.length || !existing[0].id) {
      console.warn(`! no id resolved for ${seed.profile_slug}`);
      continue;
    }
    listingId = existing[0].id;
    skippedListings++;
    console.log(`= existing ${seed.profile_slug}`);
  }

  // Check if reviews already exist for this listing — if so, skip to avoid duplicates.
  const existingReviews = await query(
    `SELECT count(*)::int AS c FROM hammerex_xrated_reviews WHERE listing_id = ${esc(listingId)}::uuid;`
  );
  const haveReviews = (existingReviews?.[0]?.c ?? 0) > 0;
  if (haveReviews) {
    console.log(`  = ${existingReviews[0].c} reviews already present, skipping`);
    continue;
  }

  for (const review of seed.reviews) {
    const customerEmail =
      "customer-" + Math.random().toString(36).slice(2, 10) + "@example.com";
    const reviewSql = `
      INSERT INTO hammerex_xrated_reviews (
        listing_id, customer_name, customer_email, customer_postcode,
        project_type, overall_rating, workmanship_rating, communication_rating,
        value_rating, timeliness_rating, body, photo_urls, service_name,
        status, goes_live_at, submitted_at, created_at
      )
      VALUES (
        ${esc(listingId)}::uuid, ${esc(review.customer_name)},
        ${esc(customerEmail)}, NULL, ${esc(review.project_type)},
        ${review.rating}, ${review.rating}, ${review.rating}, ${review.rating}, ${review.rating},
        ${esc(review.body)}, ARRAY[]::text[], ${esc(review.service_name)},
        'live', now() - interval '10 days',
        now() - (random() * interval '150 days') - interval '30 days',
        now() - (random() * interval '150 days') - interval '30 days'
      );
    `;
    await query(reviewSql);
    insertedReviews++;
  }
  console.log(`  + ${seed.reviews.length} reviews inserted`);
}

console.log(
  `\nDone. Listings: +${insertedListings} new / =${skippedListings} existing. Reviews: +${insertedReviews}.`
);
