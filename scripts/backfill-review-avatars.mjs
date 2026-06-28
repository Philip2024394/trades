// One-shot avatar backfill for already-seeded demo reviews.
//
// The main seed script (seed-demo-trades.mjs) does an idempotency
// check that SKIPS review insertion when reviews already exist for a
// listing. That means the 39 demos that were seeded BEFORE we added
// customer_avatar_url to the schema still have NULL avatars on their
// review rows. This script walks DEMO_TRADE_SEEDS and runs an UPDATE
// per review, keyed on (listing_id, customer_name, body) so we hit
// the exact row even when names collide across listings.
//
// Safe to re-run. Each UPDATE matches at most one row; reviews
// already populated with the correct URL just get re-written with
// the same value (no churn).
//
// Run: node scripts/backfill-review-avatars.mjs

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
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Supabase ${r.status}: ${txt}`);
  }
  return r.json();
}

function esc(s) {
  if (s === null || s === undefined) return "NULL";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

let updated = 0;
let missing = 0;

for (const seed of DEMO_TRADE_SEEDS) {
  // Resolve listing_id from the profile_slug.
  const found = await query(
    `SELECT id FROM hammerex_trade_off_listings WHERE slug = ${esc(seed.profile_slug)};`
  );
  if (!Array.isArray(found) || !found.length || !found[0].id) {
    console.warn(`! no listing for ${seed.profile_slug} — skipped`);
    continue;
  }
  const listingId = found[0].id;

  for (const review of seed.reviews) {
    // Match on listing + customer_name + body. Body is long enough
    // to be unique within a listing; customer_name + listing is also
    // unique in practice given the seed data.
    const updateSql = `
      UPDATE hammerex_xrated_reviews
      SET customer_avatar_url = ${esc(review.avatar_url)}
      WHERE listing_id = ${esc(listingId)}::uuid
        AND customer_name = ${esc(review.customer_name)}
        AND body = ${esc(review.body)}
      RETURNING id;
    `;
    const result = await query(updateSql);
    if (Array.isArray(result) && result.length > 0) {
      updated++;
    } else {
      missing++;
      console.warn(
        `! no row matched for ${seed.profile_slug} → ${review.customer_name}`
      );
    }
  }
  console.log(`= ${seed.profile_slug}: processed ${seed.reviews.length} reviews`);
}

console.log(`\nDone. Updated ${updated} review rows. Missed ${missing}.`);
